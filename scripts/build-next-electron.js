/**
 * Cross-platform Next.js build with Electron build flag.
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const nextBin = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_BUILD: "true",
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
