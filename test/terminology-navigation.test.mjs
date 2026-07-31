import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/glossary/navigation.js", import.meta.url), "utf8");
const bootstrap = await readFile(new URL("../src/scripts/i18n/locale-bootstrap.js", import.meta.url), "utf8");

test("terminology navigation exposes filter and next-issue controls", () => {
  assert.match(source, /term-nav-filter/);
  assert.match(source, /focusNextIssue/);
  assert.match(source, /term-qa-flagged/);
});

test("terminology navigation uses shared localized messages", () => {
  assert.match(source, /terminology\.filter/);
  assert.match(source, /terminology\.count/);
  assert.doesNotMatch(source, /const NAV_TEXT/);
  assert.match(bootstrap, /"terminology\.filter": "Terminology"/);
  assert.match(bootstrap, /"terminology\.filter": "Терминология"/);
  assert.match(bootstrap, /терминологични проблема/);
});
