import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/glossary/navigation.js", import.meta.url), "utf8");

test("terminology navigation exposes filter and next-issue controls", () => {
  assert.match(source, /term-nav-filter/);
  assert.match(source, /focusNextIssue/);
  assert.match(source, /term-qa-flagged/);
});

test("terminology navigation is localized", () => {
  assert.match(source, /Terminology/);
  assert.match(source, /Терминология/);
  assert.match(source, /терминологични проблема/);
});
