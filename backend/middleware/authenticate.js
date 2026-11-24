const { httpError } = require("../lib/errors");
const { verifyToken, verifyStudentToken } = require("../modules/auth/auth.service");

function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const claims = match && verifyToken(match[1]);
  if (!claims) {
    return next(httpError(401, "UNAUTHORIZED"));
  }
  req.auth = claims;
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (req.auth?.role !== "SUPERADMIN") return next(httpError(403, "FORBIDDEN"));
  return next();
}

function requireFeeAdmin(req, res, next) {
  if (!["ADMIN", "SUPERADMIN"].includes(req.auth?.role)) return next(httpError(403, "FORBIDDEN"));
  return next();
}

function authenticateStudent(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const claims = match && verifyStudentToken(match[1]);
  if (!claims) return next(httpError(401, "UNAUTHORIZED"));
  req.auth = claims;
  return next();
}

module.exports = { authenticate, authenticateStudent, requireSuperAdmin, requireFeeAdmin };
