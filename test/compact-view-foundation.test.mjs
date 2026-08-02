import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("src/index.html", "utf8");
const app = fs.readFileSync("src/scripts/app.js", "utf8");
const css = fs.readFileSync("src/styles/app.css", "utf8");
const en = JSON.parse(fs.readFileSync("src/scripts/i18n/locales/en.json", "utf8"));
const bg = JSON.parse(fs.readFileSync("src/scripts/i18n/locales/bg.json", "utf8"));
const ru = JSON.parse(fs.readFileSync("src/scripts/i18n/locales/ru.json", "utf8"));

test("Compact view exposes an explicit layout toggle and essential workspace bar", () => {
  assert.ok(html.includes('id="compactToggle"'));
  assert.ok(html.includes('id="compactBar"'));
  assert.ok(html.includes('id="compactFilename"'));
  assert.ok(html.includes('id="compactProgress"'));
  assert.ok(html.includes('id="compactSaveStatus"'));
  assert.ok(html.includes('id="compactExit"'));
});

test("Compact view is a non-destructive layout state", () => {
  assert.ok(app.includes('compactView: false'));
  assert.ok(app.includes('document.documentElement.classList.toggle("compact-view"'));
  assert.ok(!app.includes("removeChild(compact"));
  assert.ok(!app.includes("replaceChildren(compact"));
});

test("Compact bar mirrors existing workspace state", () => {
  assert.ok(app.includes("syncCompactBar"));
  assert.ok(app.includes("compactFilename"));
  assert.ok(app.includes("compactProgress"));
  assert.ok(app.includes("compactSaveStatus"));
});

test("reviewed locales include Compact view foundation messages", () => {
  for (const locale of [en, bg, ru]) {
    for (const key of [
      "compact.enter",
      "compact.enterTitle",
      "compact.exit",
      "compact.exitTitle",
      "compact.unnamed",
      "compact.progress"
    ]) assert.equal(typeof locale.messages[key], "string", `${locale.code}: ${key}`);
  }
});

test("Compact view has responsive and RTL-safe baseline styles", () => {
  assert.ok(css.includes("html.compact-view"));
  assert.ok(css.includes("#compactBar"));
  assert.ok(css.includes("@media (max-width:"));
  assert.ok(css.includes("margin-inline"));
});
