import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const locales = Object.fromEntries(await Promise.all(["en", "bg", "ru"].map(async code => [code, JSON.parse(await readFile(new URL(`../src/scripts/i18n/locales/${code}.json`, import.meta.url), "utf8"))])));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const requiredKeys = [
  "settings.tab.general", "settings.tab.fonts", "settings.tab.machine-translation", "settings.tab.secrets",
  "settings.font.title", "settings.font.hint", "settings.font.interface", "settings.font.editor",
  "settings.secretVaultTitle", "settings.secretVaultHint", "settings.secretVaultEmpty",
  "settings.secretVaultExport", "settings.secretVaultImport", "settings.secretVaultClear"
];

test("reviewed locales contain Settings font and secret messages", () => {
  for (const locale of Object.values(locales)) {
    for (const key of requiredKeys) assert.ok(locale.messages[key], `missing ${key} in ${locale.code}`);
  }
});

test("reference footer wording is language-correct", () => {
  assert.equal(locales.en.messages["footnote.same"], " · same as reference: {n}");
  assert.equal(locales.bg.messages["footnote.same"], " · като референцията: {n}");
  assert.equal(locales.ru.messages["footnote.same"], " · как в источнике: {n}");
});

test("the normal build regenerates locale assets before standalone HTML", () => {
  assert.match(packageJson.scripts.build, /generate-locale-assets\.mjs\s*&&\s*node scripts\/build-standalone\.mjs/);
});
