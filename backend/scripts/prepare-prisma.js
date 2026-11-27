const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const backendRoot = path.resolve(__dirname, "..");
require("../config/database-url");
const enginesRoot = path.join(backendRoot, "node_modules", "@prisma", "engines");
const env = { ...process.env };

if (process.platform === "win32") {
  const localEngines = {
    PRISMA_SCHEMA_ENGINE_BINARY: "schema-engine-windows.exe",
    PRISMA_QUERY_ENGINE_LIBRARY: "query_engine-windows.dll.node",
  };

  for (const [key, fileName] of Object.entries(localEngines)) {
    const enginePath = path.join(enginesRoot, fileName);
    if (fs.existsSync(enginePath)) env[key] = enginePath;
  }
}

const prismaCli = path.join(backendRoot, "node_modules", "prisma", "build", "index.js");

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: backendRoot,
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runPrisma(["generate"]);
runPrisma(["migrate", "deploy"]);
