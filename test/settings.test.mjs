import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/scripts/settings.js", import.meta.url), "utf8");
const englishLocale = JSON.parse(await readFile(new URL("../src/scripts/i18n/locales/en.json", import.meta.url), "utf8"));
const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");

test("settings scripts load after built-in locale data", () => {
  const registryIndex = index.indexOf("scripts/i18n/locales.js");
  const builtInIndex = index.indexOf("built-in-locales.generated.js");
  const bootstrapIndex = index.indexOf("locale-bootstrap.js");
  const settingsIndex = index.indexOf("scripts/settings.js");
  assert.ok(registryIndex >= 0);
  assert.ok(builtInIndex > registryIndex);
  assert.ok(bootstrapIndex > builtInIndex);
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

test("reference observer cannot react to its own reminder attributes", () => {
  assert.match(settings, /dataset\.referenceReminder\s*!==\s*nextValue/);
  assert.match(settings, /observer\.observe\(referenceButton,\s*\{\s*childList:\s*true,\s*subtree:\s*true,\s*characterData:\s*true\s*\}\)/);
  assert.doesNotMatch(settings, /observer\.observe\(referenceButton,[^\n]*attributes:\s*true/);
});

test("settings messages are stored in the English locale", () => {
  assert.equal(englishLocale.messages["settings.button"], "Settings");
  assert.equal(englishLocale.messages["settings.referenceReminder"], "Highlight missing en.lang reference");
  assert.equal(englishLocale.messages["settings.close"], "Close");
});

test("standalone build embeds settings and generated locales", () => {
  assert.match(build, /built-in-locales\.generated\.js/);
  assert.match(build, /scripts\/settings\.js/);
  assert.match(build, /<script>\$\{settings\}<\/script>/);
});
