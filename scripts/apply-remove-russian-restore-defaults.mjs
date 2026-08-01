import { readFile, writeFile } from "node:fs/promises";

const appPath = new URL("../src/scripts/app.js", import.meta.url);
const testPath = new URL("../test/no-russian-restore-defaults.test.mjs", import.meta.url);

let source = await readFile(appPath, "utf8");

const replacements = [
  ['state.filename = d.f || "ru.lang";', 'state.filename = d.f || "";'],
  ['state.filename = data.filename || "ru.lang";', 'state.filename = data.filename || "";'],
  ['const lang = state.targetLang || "ru";', 'const lang = state.targetLang || "";'],
  ['let v = String(raw || "").trim().replace(/_/g, "-") || "ru";', 'let v = String(raw || "").trim().replace(/_/g, "-");']
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Expected fragment not found: ${before}`);
  source = source.replace(before, after);
}

await writeFile(appPath, source, "utf8");

const test = `import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");

test("restoring progress never invents a Russian filename", () => {
  assert.doesNotMatch(source, /d\\.f \\|\\| ["']ru\\.lang["']/);
  assert.doesNotMatch(source, /data\\.filename \\|\\| ["']ru\\.lang["']/);
  assert.match(source, /state\\.filename = d\\.f \\|\\| ["']["']/);
  assert.match(source, /state\\.filename = data\\.filename \\|\\| ["']["']/);
});

test("machine translation and spellcheck have no implicit Russian target", () => {
  assert.doesNotMatch(source, /state\\.targetLang \\|\\| ["']ru["']/);
  assert.doesNotMatch(source, /replace\\(\/_\\/g, ["']-["']\\) \\|\\| ["']ru["']/);
});
`;

await writeFile(testPath, test, "utf8");
console.log("Removed implicit Russian restore and target defaults.");
