import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/glossary/navigation.js", import.meta.url), "utf8");
const englishLocale = JSON.parse(await readFile(new URL("../src/scripts/i18n/locales/en.json", import.meta.url), "utf8"));
const bulgarianLocale = JSON.parse(await readFile(new URL("../src/scripts/i18n/locales/bg.json", import.meta.url), "utf8"));

test("terminology navigation exposes filter and next-issue controls", () => {
  assert.match(source, /term-nav-filter/);
  assert.match(source, /focusNextIssue/);
  assert.match(source, /term-qa-flagged/);
});

test("terminology navigation uses shared localized messages", () => {
  assert.match(source, /terminology\.filter/);
  assert.match(source, /terminology\.count/);
  assert.doesNotMatch(source, /const NAV_TEXT/);
  assert.equal(englishLocale.messages["terminology.filter"], "Terminology");
  assert.equal(bulgarianLocale.messages["terminology.filter"], "Терминология");
  assert.match(bulgarianLocale.messages["terminology.count.other"], /терминологични проблема/);
});
