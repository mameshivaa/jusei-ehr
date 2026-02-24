#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const standaloneDir = path.join(repoRoot, ".next", "standalone");
const electronBuilderBin = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);

if (process.env.SKIP_ELECTRON_BUILDER_INSTALL_APP_DEPS === "1") {
  console.log("[postinstall] Skipped: SKIP_ELECTRON_BUILDER_INSTALL_APP_DEPS=1");
  process.exit(0);
}

if (!existsSync(standaloneDir)) {
  console.log(
    "[postinstall] Skipped: .next/standalone is missing (run electron build first)."
  );
  process.exit(0);
}

if (!existsSync(electronBuilderBin)) {
  console.log(
    "[postinstall] Skipped: electron-builder binary was not found in node_modules/.bin."
  );
  process.exit(0);
}

const result = spawnSync(electronBuilderBin, ["install-app-deps"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error("[postinstall] Failed to run electron-builder:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
