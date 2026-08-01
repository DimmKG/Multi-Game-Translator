import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");
const tabs = await readFile(new URL("../src/scripts/settings-tabs.js", import.meta.url), "utf8");
const locales = await Promise.all(["en", "bg", "ru"].map(async code => JSON.parse(await readFile(new URL(`../src/scripts/i18n/locales/${code}.json`, import.meta.url), "utf8"))));

test("reference-file UI shows the actual loaded filename", () => {
  assert.match(app, /btn\.enRefLoaded\", \{file: state\.referenceFilename, n\}/);
  assert.match(app, /toast\.referenceMatched\", \{file: f\.name, n\}/);
});

test("human-maintained locales describe a general reference file", () => {
  for (const locale of locales) {
    assert.ok(locale.messages["btn.enRef"]);
    assert.match(locale.messages["btn.enRefTitle"], /\.lang/i);
    assert.ok(locale.messages["card.referenceText"]);
    assert.ok(locale.messages["mt.needReference"]);
    assert.equal(locale.messages["card.enOriginal"], undefined);
    assert.equal(locale.messages["mt.needEnRef"], undefined);
  }
});

test("Google's current English-source limitation remains explicit", () => {
  assert.match(locales[0].messages["btn.enRefTitle"], /Google provider expects English source text/);
  assert.match(locales[0].messages["settings.referenceReminderHint"], /English reference/);
});

test("Settings tab labels come from locale messages", () => {
  assert.match(tabs, /settings\.tabsLabel/);
  for (const locale of locales) {
    for (const id of ["general", "fonts", "machine-translation", "secrets"]) {
      assert.ok(locale.messages[`settings.tab.${id}`]);
    }
  }
});
