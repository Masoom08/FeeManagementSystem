require("../config/database-url");

const mysql = require("mysql2/promise");

async function main() {
  if (!/^[a-zA-Z0-9_]+$/.test(process.env.DB_NAME || "")) {
    throw new Error("DB_NAME must contain only letters, numbers, and underscores");
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
  });
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database ${process.env.DB_NAME} is ready.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
