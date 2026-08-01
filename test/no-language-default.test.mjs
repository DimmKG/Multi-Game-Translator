import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");
const target = await readFile(new URL("../src/scripts/mt/target-language.js", import.meta.url), "utf8");

test("application state has no hardcoded translation language default", () => {
  assert.match(app, /filename:\s*""/);
  assert.match(app, /targetLang:\s*""/);
  assert.doesNotMatch(app, /filename:\s*"ru\.lang"/);
  assert.doesNotMatch(app, /targetLang:\s*"ru"/);
});

test("filename cleanup uses a neutral fallback", () => {
  assert.match(app, /String\(name \|\| ""\)/);
  assert.match(app, /return base \? base \+ "\.lang" : "translation\.lang"/);
  assert.doesNotMatch(app, /base \|\| "ru"/);
});

test("target selection remains explicit or filename-derived", () => {
  assert.match(target, /const chosen = current \|\| inferred/);
  assert.match(target, /if \(!chosen\) input\.value = ""/);
  assert.doesNotMatch(target, /return\s+"ru"/);
  assert.doesNotMatch(target, /\|\|\s*"ru"/);
});
