#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PACKAGE = "@zenoverse/cursorcrew";
const command = process.argv[2];

function fail(message) {
  console.error("\nCursorCrew: " + message + "\n");
  process.exit(1);
}

function findFile(files) {
  return files.find(file => fs.existsSync(file));
}

function backup(file) {
  const backupFile = file + ".cursorcrew.bak";
  if (fs.existsSync(backupFile)) fail("Backup already exists: " + backupFile);
  fs.copyFileSync(file, backupFile);
  console.log("Backup created: " + backupFile);
}

function addImport(source, line) {
  if (source.includes(line)) return source;
  const imports = [...source.matchAll(/^import\s.+?;?\s*$/gm)];
  if (!imports.length) return line + "\n" + source;
  const last = imports[imports.length - 1];
  const position = last.index + last[0].length;
  return source.slice(0, position) + "\n" + line + source.slice(position);
}

function writeComponent(file) {
  if (fs.existsSync(file)) fail("Refusing to overwrite " + file);
  fs.writeFileSync(file, `import { useEffect } from "react";

export default function CursorCrewEffect() {
  useEffect(() => {
    let crew: { destroy(): void } | undefined;
    let cancelled = false;

    import("@zenoverse/cursorcrew").then(({ CursorCrew }) => {
      if (!cancelled) {
        crew = new CursorCrew({ selector: "body", agents: 12 });
      }
    }).catch(error => console.error("CursorCrew failed to load:", error));

    return () => {
      cancelled = true;
      crew?.destroy();
    };
  }, []);

  return null;
}
`);
}

function installPackage() {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (pkg.dependencies?.[PACKAGE] || pkg.devDependencies?.[PACKAGE]) {
    console.log("CursorCrew dependency already installed.");
    return;
  }

  const manager = fs.existsSync("bun.lock") || fs.existsSync("bun.lockb")
    ? "bun"
    : fs.existsSync("pnpm-lock.yaml") ? "pnpm"
    : fs.existsSync("yarn.lock") ? "yarn" : "npm";

  console.log("Installing CursorCrew using " + manager + "...");
  const result = spawnSync(
    manager,
    manager === "npm" ? ["install", PACKAGE] : ["add", PACKAGE],
    { stdio: "inherit" }
  );

  if (result.status !== 0) fail("Dependency installation failed.");
}

function setupVite(entry) {
  let source = fs.readFileSync(entry, "utf8");

  if (source.includes("CursorCrewEffect")) {
    console.log("CursorCrew already appears integrated.");
    return true;
  }

  const strict = /(\.render\s*\(\s*<StrictMode>\s*)(<App\s*\/>)(\s*<\/StrictMode>\s*,?\s*\))/;
  const normal = /(\.render\s*\(\s*)(<App\s*\/>)(\s*\))/;

  if (strict.test(source)) {
    source = source.replace(strict, "$1<><App /><CursorCrewEffect /></>$3");
  } else if (normal.test(source)) {
    source = source.replace(normal, "$1<><App /><CursorCrewEffect /></>$3");
  } else {
    return false;
  }

  const component = path.join(path.dirname(entry), "CursorCrewEffect.tsx");
  if (fs.existsSync(component)) fail("Component already exists: " + component);

  backup(entry);
  writeComponent(component);
  source = addImport(source, "import CursorCrewEffect from \"./CursorCrewEffect\";");
  fs.writeFileSync(entry, source);
  console.log("Integrated CursorCrew into " + entry);
  return true;
}

function setupNext(layout) {
  let source = fs.readFileSync(layout, "utf8");

  if (source.includes("CursorCrewEffect")) {
    console.log("CursorCrew already appears integrated.");
    return true;
  }

  if (!source.includes("</body>")) return false;

  const component = path.join(path.dirname(layout), "CursorCrewEffect.tsx");
  if (fs.existsSync(component)) fail("Component already exists: " + component);

  backup(layout);
  writeComponent(component);
  source = source.replace("</body>", "  <CursorCrewEffect />\n      </body>");
  source = addImport(source, "import CursorCrewEffect from \"./CursorCrewEffect\";");
  fs.writeFileSync(layout, source);
  console.log("Integrated CursorCrew into " + layout);
  return true;
}

if (command !== "setup") {
  console.log("CursorCrew CLI\n\nUsage: npx " + PACKAGE + " setup\n");
  process.exit(command ? 1 : 0);
}

if (!fs.existsSync("package.json")) {
  fail("Run this command from your portfolio project root.");
}

const next = findFile([
  "src/app/layout.tsx",
  "src/app/layout.jsx",
  "app/layout.tsx",
  "app/layout.jsx"
]);

const vite = findFile([
  "src/main.tsx",
  "src/main.jsx",
  "main.tsx",
  "main.jsx"
]);

if (!next && !vite) {
  fail("Unsupported project structure. No application files changed.");
}

installPackage();

const integrated = next ? setupNext(next) : setupVite(vite);

if (!integrated) {
  fail("Could not safely identify the React root. Dependency installed, but application files were not integrated.");
}

console.log("\nCursorCrew setup complete! Start your project normally.\n");
