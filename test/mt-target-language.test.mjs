import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const targetLanguage = await readFile(new URL("../src/scripts/mt/target-language.js", import.meta.url), "utf8");
const navigation = await readFile(new URL("../src/scripts/glossary/navigation.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");

test("MT target language has an explicit unselected state", () => {
  assert.match(targetLanguage, /empty\.value\s*=\s*""/);
  assert.match(targetLanguage, /empty\.disabled\s*=\s*true/);
  assert.doesNotMatch(targetLanguage, /return\s+"ru"/);
  assert.doesNotMatch(targetLanguage, /\|\|\s*"ru"/);
});

test("recognized filenames and aliases are normalized safely", () => {
  assert.match(targetLanguage, /\["bg",\s*"Български"\]/);
  assert.match(targetLanguage, /\["pt-BR",\s*"Português \(Brasil\)"\]/);
  assert.match(targetLanguage, /\["zh-TW",\s*"中文（繁體）"\]/);
  assert.match(targetLanguage, /\["pr-br",\s*"pt-BR"\]/);
  assert.match(targetLanguage, /function codeFromFilename/);
  assert.match(targetLanguage, /return normalizeProjectCode\(base\)/);
});

test("unknown filenames do not commit a guessed target", () => {
  assert.match(targetLanguage, /const chosen = current \|\| inferred/);
  assert.match(targetLanguage, /if \(!chosen\) input\.value = ""/);
  assert.match(targetLanguage, /if \(!code\) \{\s*select\.value = "";\s*return;/);
});

test("machine translation stays unavailable without a target", () => {
  assert.match(targetLanguage, /const disabled = !select\.value/);
  assert.match(targetLanguage, /button\.disabled = disabled/);
  assert.match(targetLanguage, /event\.stopImmediatePropagation\(\)/);
});

test("hosted and standalone builds load the MT target module", () => {
  assert.match(navigation, /scripts\/mt\/target-language\.js/);
  assert.match(build, /scripts\/mt\/target-language\.js/);
  assert.match(build, /targetLanguage/);
});
