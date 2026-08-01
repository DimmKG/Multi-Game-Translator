import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/scripts/settings.js", import.meta.url), "utf8");
const messages = await readFile(new URL("../src/scripts/i18n/settings-messages.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");

test("settings scripts load before dependent interface modules", () => {
  const messageIndex = index.indexOf("settings-messages.js");
  const bootstrapIndex = index.indexOf("locale-bootstrap.js");
  const settingsIndex = index.indexOf("scripts/settings.js");
  assert.ok(messageIndex >= 0);
  assert.ok(bootstrapIndex > messageIndex);
  assert.ok(settingsIndex > bootstrapIndex);
});

test("reference reminder is persisted and can be disabled", () => {
  assert.match(settings, /necesse-translator\.settings\.v1/);
  assert.match(settings, /referenceReminder:\s*true/);
  assert.match(settings, /localStorage\.setItem/);
  assert.match(settings, /settings-reference-needed/);
  assert.match(settings, /textContent\?\.includes\("✓"\)/);
  assert.match(settings, /MutationObserver/);
});

test("settings messages are shared through I18N", () => {
  assert.match(messages, /settings\.referenceReminder/);
  assert.match(messages, /globalThis\.I18N/);
  assert.match(messages, /NecesseSettingsMessages/);
});

test("standalone build embeds settings", () => {
  assert.match(build, /settings-messages\.js/);
  assert.match(build, /scripts\/settings\.js/);
  assert.match(build, /<script>\$\{settings\}<\/script>/);
});
