/**
 * Prepare the Electron app directory (.next/standalone)
 * - Remove "build" from the generated package.json (electron-builder disallows it)
 * - Copy Electron-specific node_modules not traced by Next.js standalone
 */

const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const appDir = path.join(rootDir, ".next", "standalone");
const pkgPath = path.join(appDir, "package.json");

if (!fs.existsSync(pkgPath)) {
  process.exit(0);
}

const raw = fs.readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(raw);
const rootPkgPath = path.join(rootDir, "package.json");
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));

// Electron runtime deps required by main process - must be in dependencies so
// electron-builder does not prune them from the packaged app (MS Store, etc.).
// NOTE:
// We intentionally keep the full production dependency set from the project
// root, because reducing this list caused required runtime modules (Prisma,
// React, PDF stack) to be dropped from packaged builds.
const ELECTRON_RUNTIME_DEPS = [
  "next",
  "electron-updater",
  "@next/env",
  "better-sqlite3",
  "@prisma/client",
];

const runtimeDeps = { ...(rootPkg.dependencies || {}) };
for (const name of ELECTRON_RUNTIME_DEPS) {
  const ver =
    rootPkg.dependencies?.[name] ??
    rootPkg.devDependencies?.[name] ??
    "*";
  runtimeDeps[name] = ver;
}

const packagedPkg = {
  name: pkg.name || rootPkg.name || "app",
  version: pkg.version || rootPkg.version || "0.0.0",
  private: true,
  license: pkg.license || rootPkg.license,
  description: pkg.description || rootPkg.description,
  author: pkg.author || rootPkg.author,
  main: "electron-dist/main.js",
  dependencies: runtimeDeps,
  devDependencies: {},
};

fs.writeFileSync(pkgPath, `${JSON.stringify(packagedPkg, null, 2)}\n`);

const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
};

copyDir(
  path.join(rootDir, "electron-dist"),
  path.join(appDir, "electron-dist"),
);
copyDir(path.join(rootDir, "public"), path.join(appDir, "public"));
copyDir(
  path.join(rootDir, ".next", "static"),
  path.join(appDir, ".next", "static"),
);

// ---------------------------------------------------------------------------
// Copy Electron-specific npm packages (not traced by Next.js standalone)
// ---------------------------------------------------------------------------
const rootModules = path.join(rootDir, "node_modules");
const appModules = path.join(appDir, "node_modules");

/**
 * Recursively copy a package and its production dependencies from the root
 * node_modules into the standalone node_modules.  Skips packages that are
 * already present in the target (e.g. already traced by Next.js).
 */
const copied = new Set();
function copyModule(name) {
  if (copied.has(name)) return;
  copied.add(name);

  const src = path.join(rootModules, ...name.split("/"));
  if (!fs.existsSync(src)) {
    console.warn(`[prepare-appdir] WARNING: ${name} not found in root node_modules, skipping`);
    return;
  }

  const dest = path.join(appModules, ...name.split("/"));
  // Standalone output may contain partially traced modules (e.g. next/ without
  // package.json). Always replace with the full runtime package to avoid
  // "Cannot find module" at startup in packaged builds.
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });

  // Recurse into production dependencies
  const depPkgPath = path.join(src, "package.json");
  if (fs.existsSync(depPkgPath)) {
    try {
      const depPkg = JSON.parse(fs.readFileSync(depPkgPath, "utf8"));
      for (const dep of Object.keys(depPkg.dependencies || {})) {
        copyModule(dep);
      }
    } catch {
      // ignore parse errors
    }
  }
}

for (const dep of ELECTRON_RUNTIME_DEPS) {
  copyModule(dep);
}

// Prisma generated client lives under node_modules/.prisma/client.
// AppX packaging can drop hidden directories, so copy it to a visible path.
const prismaClientAliasDir = path.join(appDir, "prisma-client");
copyDir(path.join(rootModules, ".prisma", "client"), prismaClientAliasDir);

// Patch @prisma/client bridge entrypoints to use the visible alias path.
const prismaBridgeFiles = [
  "default.js",
  "index.js",
  "edge.js",
  "react-native.js",
  "wasm.js",
  "sql.js",
  "index-browser.js",
];
for (const file of prismaBridgeFiles) {
  const bridgePath = path.join(appModules, "@prisma", "client", file);
  if (!fs.existsSync(bridgePath)) {
    continue;
  }
  const source = fs.readFileSync(bridgePath, "utf8");
  const patched = source
    // e.g. require(".prisma/client/default")
    .replace(/(['"])\.prisma\/client\//g, "$1../../../prisma-client/")
    // e.g. require(".prisma/client")
    .replace(/(['"])\.prisma\/client(['"])/g, "$1../../../prisma-client$2");
  if (patched !== source) {
    fs.writeFileSync(bridgePath, patched);
  }
  if (patched.includes(".prisma/client")) {
    console.error(
      `[prepare-appdir] ERROR: Unpatched Prisma bridge remains in ${bridgePath}`,
    );
    process.exit(1);
  }
}

const REQUIRED_RUNTIME_PATHS = [
  {
    label: "next",
    path: path.join(appModules, "next", "package.json"),
  },
  {
    label: "react",
    path: path.join(appModules, "react", "package.json"),
  },
  {
    label: "pdfkit",
    path: path.join(appModules, "pdfkit", "package.json"),
  },
  {
    label: "electron-updater",
    path: path.join(appModules, "electron-updater", "package.json"),
  },
  {
    label: "@prisma/client",
    path: path.join(appModules, "@prisma", "client", "package.json"),
  },
  {
    label: "prisma-client alias",
    path: path.join(appDir, "prisma-client", "default.js"),
  },
];

const missingRuntime = REQUIRED_RUNTIME_PATHS.filter(
  (entry) => !fs.existsSync(entry.path),
);
if (missingRuntime.length > 0) {
  console.error(
    `[prepare-appdir] ERROR: Missing required runtime files: ${missingRuntime
      .map((entry) => `${entry.label} (${entry.path})`)
      .join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `[prepare-appdir] Copied ${copied.size} Electron runtime package(s): ${[...copied].join(", ")}`,
);
