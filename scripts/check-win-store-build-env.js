/**
 * Windows Store (AppX) build preflight checks.
 * - On macOS, AppX cross-build requires local `pwsh` and `wine` (or Parallels VM).
 */

const { spawnSync } = require("node:child_process");

const hasCommand = (command) => {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
};

if (process.platform === "darwin") {
  const hasWine = hasCommand("wine64") || hasCommand("wine");
  const hasPwsh = hasCommand("pwsh");
  const missingTools = [];

  if (!hasWine) {
    missingTools.push("wine64 (or wine)");
  }

  if (!hasPwsh) {
    missingTools.push("pwsh");
  }

  if (missingTools.length > 0) {
    console.error("Missing macOS cross-build dependencies for AppX:");
    for (const tool of missingTools) {
      console.error(`- ${tool}`);
    }
    console.error("");
    console.error("Option A: build on GitHub Actions (recommended)");
    console.error("- Run workflow: release-win-store");
    console.error("");
    console.error("Option B: install local dependencies");
    console.error("brew install --cask wine-stable");
    console.error("brew install --cask powershell");
    process.exit(1);
  }
}

console.log("Windows Store build preflight passed.");
