const crypto = require("crypto");
const { promisify } = require("util");
const { pool } = require("../../config/db");
const { httpError } = require("../../lib/errors");

const scrypt = promisify(crypto.scrypt);
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
const STUDENT_TOKEN_TTL_SECONDS = 24 * 60 * 60;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored).split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function sign(payload) {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) throw httpError(503, "AUTH_TOKEN_SECRET_NOT_CONFIGURED");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function issueStudentToken(studentId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: studentId,
    studentId,
    role: "STUDENT",
    iat: now,
    exp: now + STUDENT_TOKEN_TTL_SECONDS,
  })).toString("base64url");
  return {
    accessToken: `${payload}.${sign(payload)}`,
    tokenType: "Bearer",
    expiresIn: STUDENT_TOKEN_TTL_SECONDS,
  };
}

function readSignedToken(token) {
  if (!process.env.AUTH_TOKEN_SECRET || typeof token !== "string") return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  try {
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims.sub || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

async function login(email, password) {
  const [users] = await pool.execute(
    "SELECT id, email, password_hash AS passwordHash, role, active FROM users WHERE email = ? LIMIT 1",
    [email.toLowerCase()]
  );
  const user = users[0];
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    throw httpError(401, "INVALID_CREDENTIALS");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  })).toString("base64url");
  return {
    accessToken: `${payload}.${sign(payload)}`,
    tokenType: "Bearer",
    expiresIn: TOKEN_TTL_SECONDS,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

function verifyToken(token) {
  const claims = readSignedToken(token);
  return claims && claims.email && ["ADMIN", "SUPERADMIN"].includes(claims.role) ? claims : null;
}

function verifyStudentToken(token) {
  const claims = readSignedToken(token);
  return claims && claims.studentId && claims.role === "STUDENT" ? claims : null;
}

module.exports = { hashPassword, login, verifyToken, issueStudentToken, verifyStudentToken };
