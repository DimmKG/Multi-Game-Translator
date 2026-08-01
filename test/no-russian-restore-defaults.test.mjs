import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");

test("restoring progress never invents a Russian filename", () => {
  assert.equal(source.includes('state.filename = d.f || "ru.lang";'), false);
  assert.equal(source.includes('state.filename = data.filename || "ru.lang";'), false);
  assert.equal(source.includes('state.filename = d.f || "";'), true);
  assert.equal(source.includes('state.filename = data.filename || "";'), true);
});

test("machine translation and spellcheck have no implicit Russian target", () => {
  assert.equal(source.includes('const lang = state.targetLang || "ru";'), false);
  assert.equal(source.includes('replace(/_/g, "-") || "ru"'), false);
});
