import { readFile, writeFile } from "node:fs/promises";

const appPath = "src/scripts/app.js";
let app = await readFile(appPath, "utf8");

const replacements = [
  ['String(name || "ru.lang")', 'String(name || "")'],
  ['return (base || "ru") + ".lang";', 'return base ? base + ".lang" : "translation.lang";'],
  ['filename: "ru.lang",', 'filename: "",'],
  ['targetLang: "ru",', 'targetLang: "",']
];

for (const [from, to] of replacements) {
  if (!app.includes(from)) throw new Error(`Expected app default not found: ${from}`);
  app = app.replace(from, to);
}

await writeFile(appPath, app, "utf8");

const testPath = "test/no-language-default.test.mjs";
await writeFile(testPath, `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");\nconst target = await readFile(new URL("../src/scripts/mt/target-language.js", import.meta.url), "utf8");\n\ntest("application state has no hardcoded translation language default", () => {\n  assert.match(app, /filename:\\s*""/);\n  assert.match(app, /targetLang:\\s*""/);\n  assert.doesNotMatch(app, /filename:\\s*"ru\\.lang"/);\n  assert.doesNotMatch(app, /targetLang:\\s*"ru"/);\n});\n\ntest("filename cleanup uses a neutral fallback", () => {\n  assert.match(app, /String\\(name \\|\\| ""\\)/);\n  assert.match(app, /return base \\? base \\+ "\\.lang" : "translation\\.lang"/);\n  assert.doesNotMatch(app, /base \\|\\| "ru"/);\n});\n\ntest("target selection remains explicit or filename-derived", () => {\n  assert.match(target, /const chosen = current \\|\\| inferred/);\n  assert.match(target, /if \\(!chosen\\) input\\.value = ""/);\n  assert.doesNotMatch(target, /return\\s+"ru"/);\n  assert.doesNotMatch(target, /\\|\\|\\s*"ru"/);\n});\n`, "utf8");

console.log("Removed implicit Russian application defaults.");
