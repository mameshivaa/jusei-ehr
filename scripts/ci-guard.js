#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const workflowsDir = path.join(repoRoot, ".github", "workflows");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const npmScripts = new Set(Object.keys(packageJson.scripts || {}));

const workflowScriptPattern = /npm run ([A-Za-z0-9:_-]+)/g;
const missingWorkflowScripts = [];

const forbiddenRules = [
  {
    label: "DEV_BYPASS_AUTH",
    pattern: /DEV_BYPASS_AUTH/g,
  },
  {
    label: "dev:free script",
    pattern: /dev:free/g,
  },
  {
    label: "development-secret fallback",
    pattern: /development-secret/g,
  },
  {
    label: "ensureDevAdmin helper",
    pattern: /ensureDevAdmin/g,
  },
  {
    label: "dev bypass module",
    pattern: /dev-bypass/g,
  },
];

const sourceAvailableTargets = [
  "src",
  "test",
  "e2e",
  "README.md",
  "DEVELOPMENT.md",
  ".env.example",
  "setup.sh",
  "package.json",
];

const forbiddenMatches = [];

function listFilesRecursively(startPath) {
  const stats = fs.statSync(startPath);
  if (stats.isFile()) {
    return [startPath];
  }
  const files = [];
  for (const entry of fs.readdirSync(startPath, { withFileTypes: true })) {
    const child = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(child));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

function runWorkflowScriptGuard() {
  if (!fs.existsSync(workflowsDir)) {
    return;
  }
  const workflowFiles = fs
    .readdirSync(workflowsDir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => path.join(workflowsDir, name));

  for (const workflowFile of workflowFiles) {
    const content = fs.readFileSync(workflowFile, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(workflowScriptPattern)) {
        const scriptName = match[1];
        if (!npmScripts.has(scriptName)) {
          missingWorkflowScripts.push({
            file: path.relative(repoRoot, workflowFile),
            line: index + 1,
            scriptName,
          });
        }
      }
    });
  }
}

function runForbiddenTokenGuard() {
  for (const target of sourceAvailableTargets) {
    const absoluteTarget = path.join(repoRoot, target);
    if (!fs.existsSync(absoluteTarget)) {
      continue;
    }
    const files = listFilesRecursively(absoluteTarget);
    for (const file of files) {
      const relative = path.relative(repoRoot, file);
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);
      for (const rule of forbiddenRules) {
        lines.forEach((line, index) => {
          if (rule.pattern.test(line)) {
            forbiddenMatches.push({
              file: relative,
              line: index + 1,
              label: rule.label,
              snippet: line.trim(),
            });
          }
          rule.pattern.lastIndex = 0;
        });
      }
    }
  }
}

function printFailures() {
  if (missingWorkflowScripts.length > 0) {
    console.error("[ci-guard] Workflow references missing npm scripts:");
    for (const issue of missingWorkflowScripts) {
      console.error(
        `  - ${issue.file}:${issue.line} -> npm run ${issue.scriptName}`,
      );
    }
  }

  if (forbiddenMatches.length > 0) {
    console.error(
      "[ci-guard] Forbidden source-available tokens were found in tracked targets:",
    );
    for (const match of forbiddenMatches) {
      console.error(
        `  - ${match.file}:${match.line} [${match.label}] ${match.snippet}`,
      );
    }
  }
}

runWorkflowScriptGuard();
runForbiddenTokenGuard();

if (missingWorkflowScripts.length > 0 || forbiddenMatches.length > 0) {
  printFailures();
  process.exit(1);
}

console.log("[ci-guard] Passed: workflow scripts and source-available guards.");
