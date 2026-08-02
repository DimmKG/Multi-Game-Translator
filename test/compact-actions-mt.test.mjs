import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("src/index.html", "utf8");
const app = fs.readFileSync("src/scripts/app.js", "utf8");
const css = fs.readFileSync("src/styles/app.css", "utf8");
const locales = ["en", "bg", "ru"].map(code => JSON.parse(fs.readFileSync(`src/scripts/i18n/locales/${code}.json`, "utf8")));

test("Compact rail exposes one contextual workspace-actions entry", () => {
  assert.match(html, /id="compactRailActions"/);
  assert.doesNotMatch(html, /id="compactRailMore"/);
  assert.match(html, /data-compact-drawer="actions"/);
});

test("Compact actions reuse existing file and translation controls", () => {
  for (const id of ["btnEnRef", "btnSaveJson", "btnLoadJson", "btnNew", "btnExport", "mtProvider", "mtTarget", "spellToggle", "acToggle"])
    assert.match(app, new RegExp(id));
  assert.match(app, /renderCompactActions/);
  assert.doesNotMatch(app, /compactMtProvider\s*=/);
  assert.doesNotMatch(app, /compactTargetLang\s*=/);
});

test("Compact action groups are contextual", () => {
  assert.match(app, /compact\.fileActions/);
  assert.match(app, /compact\.translationTools/);
  assert.match(app, /state\.view\s*===\s*"editor"/);
  assert.match(app, /compactRailActions/);
});

test("reviewed locales provide Compact action messages", () => {
  const keys = [
    "compact.actions",
    "compact.fileActions",
    "compact.translationTools",
    "compact.referenceFile",
    "compact.saveProgress",
    "compact.loadProgress",
    "compact.newFile",
    "compact.exportFile"
  ];
  for (const locale of locales) {
    assert.equal(locale.reviewed, true);
    for (const key of keys) assert.equal(typeof locale.messages[key], "string", `${locale.code}: ${key}`);
  }
});

test("Compact actions remain usable on narrow and RTL layouts", () => {
  assert.match(css, /compact-actions/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /html\[dir="rtl"\]/);
});
