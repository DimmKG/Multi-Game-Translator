import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const preview = await readFile(new URL("../scripts/preview.mjs", import.meta.url), "utf8");
const serve = await readFile(new URL("../scripts/serve.mjs", import.meta.url), "utf8");
const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
const npmrc = await readFile(new URL("../.npmrc", import.meta.url), "utf8");

test("preview uses an isolated workflow instead of building directly into tracked output", () => {
  assert.equal(packageJson.scripts.preview, "node scripts/preview.mjs");
  assert.match(preview, /const previewDir = resolve\(root, "\.preview"\)/);
  assert.match(preview, /copyFile\(resolve\(root, "dist\/necesse-lang-translator\.html"\), previewFile\)/);
});

test("preview restores every tracked generated output before starting the server", () => {
  for (const path of [
    "src/scripts/i18n/built-in-locales.generated.js",
    "src/scripts/i18n/locales/manifest.json",
    "dist/necesse-lang-translator.html"
  ]) assert.match(preview, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(preview, /finally \{[\s\S]*writeFile\(path, content\)/);
  assert.match(preview, /await runNode\("scripts\/serve\.mjs", \["\.preview"\]\)/);
});

test("local preview and dependency-install residue stay out of git", () => {
  assert.match(gitignore, /^\.preview\/$/m);
  assert.match(npmrc, /^package-lock=false$/m);
  assert.match(serve, /const rootName = process\.argv\[2\] \|\| "src"/);
});
