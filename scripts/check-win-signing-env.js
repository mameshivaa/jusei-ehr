/**
 * Windows signed release preflight checks.
 * - Ensures required signing env vars are present.
 * - On macOS, ensures cross-build dependencies exist.
 */

const { spawnSync } = require("node:child_process");

const requiredEnvVars = ["CSC_LINK", "CSC_KEY_PASSWORD"];
const missingEnvVars = requiredEnvVars.filter((name) => {
  const value = process.env[name];
  return !value || String(value).trim().length === 0;
});

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:");
  for (const name of missingEnvVars) {
    console.error(`- ${name}`);
  }
  console.error("");
  console.error("Example:");
  console.error('export CSC_LINK="/absolute/path/to/windows-codesign.pfx"');
  console.error('export CSC_KEY_PASSWORD="your-pfx-password"');
  process.exit(1);
}

if (process.platform === "darwin") {
  const hasCommand = (command) => {
    const result = spawnSync(command, ["--version"], { stdio: "ignore" });
    return !result.error && result.status === 0;
  };

  const hasWine = hasCommand("wine64") || hasCommand("wine");
  const hasMono = hasCommand("mono");
  const missingTools = [];

  if (!hasWine) {
    missingTools.push("wine64 (or wine)");
  }

  if (!hasMono) {
    missingTools.push("mono");
  }

  if (missingTools.length > 0) {
    console.error("Missing macOS cross-build dependencies:");
    for (const tool of missingTools) {
      console.error(`- ${tool}`);
    }
    console.error("");
    console.error("Install dependencies:");
    console.error("brew install --cask wine-stable");
    console.error("brew install mono");
    console.error("");
    console.error(
      "Alternative: run signed Windows build on a native Windows runner/machine.",
    );
    process.exit(1);
  }
}

console.log("Windows signing preflight passed.");
