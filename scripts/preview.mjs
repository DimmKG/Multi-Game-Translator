import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const previewDir = resolve(root, ".preview");
const previewFile = resolve(previewDir, "index.html");
const trackedOutputs = [
  resolve(root, "src/scripts/i18n/built-in-locales.generated.js"),
  resolve(root, "src/scripts/i18n/locales/manifest.json"),
  resolve(root, "dist/necesse-lang-translator.html")
];

const snapshots = new Map();
for (const path of trackedOutputs) snapshots.set(path, await readFile(path));

function runNode(script, args = []) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [resolve(root, script), ...args], {
      cwd: root,
      stdio: "inherit",
      shell: false
    });
    child.once("error", reject);
    child.once("exit", code => {
      if (code === 0) resolveRun();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

try {
  await runNode("scripts/generate-locale-assets.mjs");
  await runNode("scripts/build-standalone.mjs");
  await rm(previewDir, { recursive: true, force: true });
  await mkdir(previewDir, { recursive: true });
  await copyFile(resolve(root, "dist/necesse-lang-translator.html"), previewFile);
} finally {
  for (const [path, content] of snapshots) await writeFile(path, content);
}

console.log("Prepared clean preview in .preview/index.html");
await runNode("scripts/serve.mjs", [".preview"]);
