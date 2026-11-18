require("dotenv").config();

const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD || "";
const database = process.env.DB_NAME;

process.env.DATABASE_URL = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;

module.exports = {
  host,
  port: Number(port),
  user,
  password,
  database,
};
