import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/font-settings.js", import.meta.url), "utf8");

test("font settings separate interface and editor preferences", () => {
  assert.match(source, /interfacePreset/);
  assert.match(source, /editorPreset/);
  assert.match(source, /--user-interface-font/);
  assert.match(source, /--user-editor-font/);
});

test("custom fonts use local family names with safe fallbacks", () => {
  assert.match(source, /sanitizeFamily/);
  assert.match(source, /Noto Sans CJK SC/);
  assert.match(source, /Noto Sans Arabic/);
  assert.doesNotMatch(source, /@font-face|fetch\(|FontFace\(/);
});

test("font files are never stored or uploaded", () => {
  assert.match(source, /font-settings\.v1/);
  assert.doesNotMatch(source, /type\s*=\s*["']file["']/);
  assert.doesNotMatch(source, /ArrayBuffer|FileReader|data:font/);
});

test("font preview includes multiple writing systems", () => {
  assert.match(source, /Български/);
  assert.match(source, /العربية/);
  assert.match(source, /日本語/);
  assert.match(source, /中文/);
});

const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");

test("hosted and standalone builds load font settings", () => {
  assert.match(html, /font-settings\.js/);
  assert.match(build, /fontSettings/);
});
