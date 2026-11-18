require("../config/database-url");

const { pool } = require("../config/db");
const { hashPassword } = require("../modules/auth/auth.service");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

async function main() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER NOT NULL AUTO_INCREMENT,
    email VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'SUPERADMIN') NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY users_email_key (email),
    PRIMARY KEY (id)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  const [migrationTables] = await pool.query("SHOW TABLES LIKE '_prisma_migrations'");
  if (migrationTables.length) {
    const migrationName = "20261117120000_user_accounts";
    const [applied] = await pool.execute("SELECT id FROM _prisma_migrations WHERE migration_name = ? LIMIT 1", [migrationName]);
    if (!applied.length) {
      const migrationSql = fs.readFileSync(path.join(__dirname, "../prisma/migrations", migrationName, "migration.sql"));
      await pool.execute(
        "INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (?, ?, NOW(3), ?, 1)",
        [crypto.randomUUID(), crypto.createHash("sha256").update(migrationSql).digest("hex"), migrationName]
      );
    }
  }

  const passwordHash = await hashPassword("12345678");
  for (const user of [
    { email: "admin@gmail.com", role: "ADMIN" },
    { email: "superadmin@gmail.com", role: "SUPERADMIN" },
  ]) {
    await pool.execute(
      "INSERT INTO users (email, password_hash, role, active) VALUES (?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), active = TRUE",
      [user.email, passwordHash, user.role]
    );
  }
  console.log("Seeded teacher and Super Admin accounts with hashed passwords.");
}

main()
  .catch((error) => {
    console.error(`Could not seed user accounts: ${error.code || error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => pool.end());
