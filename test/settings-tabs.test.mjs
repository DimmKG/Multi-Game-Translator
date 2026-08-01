import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/settings-tabs.js", import.meta.url), "utf8");
const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");

test("Settings tabs expose an accessible registration API", () => {
  assert.match(source, /function register\(id, element/);
  assert.match(source, /role\", \"tablist/);
  assert.match(source, /role\", \"tab/);
  assert.match(source, /role\", \"tabpanel/);
  assert.match(source, /ArrowRight|ArrowLeft/);
});

test("Settings tabs remember the active tab and remain scrollable", () => {
  assert.match(source, /necesse-translator\.settings-tab\.v1/);
  assert.match(source, /max-height:min\(760px/);
  assert.match(source, /overflow:auto/);
});

test("existing Settings modules remain compatible with settings-list", () => {
  assert.match(source, /ui\.panels = list/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /font-settings-section/);
  assert.match(source, /settings-vault-section/);
  assert.match(source, /settings-provider-section/);
});

test("initial content is captured before tab panels are created", () => {
  const snapshot = source.indexOf("const existingChildren = [...list.children]");
  const createTabs = source.indexOf("for (const id of ORDER) ensureTab(id)");
  const adopt = source.indexOf("adoptExisting(existingChildren)");
  assert.ok(snapshot >= 0 && createTabs > snapshot && adopt > createTabs);
  assert.match(source, /node\.matches\("\.settings-tab-panel"\)/);
});

test("missing locale placeholders fall back to readable tab labels", () => {
  assert.match(source, /placeholderOnly/);
  assert.match(source, /\^\[\\s—–-\]\+\$/);
  assert.match(source, /FALLBACK\[id\]/);
});

test("hosted and standalone builds load Settings tabs", () => {
  assert.match(html, /settings-tabs\.js/);
  assert.match(build, /settingsTabs/);
});
