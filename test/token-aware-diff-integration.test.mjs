import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/scripts/app.js", "utf8");
const html = fs.readFileSync("src/index.html", "utf8");
const css = fs.readFileSync("src/styles/app.css", "utf8");

const locale = code => JSON.parse(fs.readFileSync(`src/scripts/i18n/locales/${code}.json`, "utf8"));

test("Compare loads the token-aware engine before the application", () => {
  const engine = html.indexOf("./scripts/compare/token-aware-diff.js");
  const application = html.indexOf("./scripts/app.js");
  assert.ok(engine >= 0);
  assert.ok(application > engine);
});

test("Compare exposes localized word and character inline modes", () => {
  assert.match(html, /id="diffInlineMode"/);
  assert.match(html, /data-diff-mode="word"/);
  assert.match(html, /data-diff-mode="character"/);
  assert.match(html, /data-i18n-aria-label="diff.inlineMode"/);
  assert.ok(app.includes("data-i18n-aria-label"));
  assert.match(app, /state.diffMode = button.dataset.diffMode/);
  assert.ok(app.includes("compareEntryPair(left, right, state.diffMode)"));
});

test("Compare summary separates keys, values, and status-only changes", () => {
  assert.match(app, /summary.changedKeys/);
  assert.match(app, /summary.changedValues/);
  assert.match(app, /summary.prefixOnly/);
});

test("reviewed locales include the Compare mode and summary messages", () => {
  for (const code of ["en", "bg", "ru"]) {
    const messages = locale(code).messages;
    for (const key of ["diff.inlineMode", "diff.modeWords", "diff.modeCharacters", "diff.changedKeys", "diff.changedValues", "diff.prefixOnly"]) {
      assert.equal(typeof messages[key], "string", `${code} missing ${key}`);
      assert.ok(messages[key].length > 0);
    }
  }
});

test("Compare controls remain responsive and keyboard-visible", () => {
  assert.match(css, /.diff-mode-btn:focus-visible/);
  assert.ok(css.includes("@media (max-width:760px)"));
});
