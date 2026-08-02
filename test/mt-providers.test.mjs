import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const providers = await readFile(new URL("../src/scripts/mt/providers.js", import.meta.url), "utf8");
const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");

test("machine translation providers use a shared registry", () => {
  assert.match(providers, /function register\(definition\)/);
  assert.match(providers, /async function translate\(id, request/);
  assert.match(providers, /globalThis.NecesseMtProviders/);
  assert.match(providers, /id: "google"/);
});

test("Google-specific language aliases live in the Google provider", () => {
  assert.match(providers, /"pt-br": "pt"/);
  assert.match(providers, /"zh-tw": "zh-TW"/);
  assert.ok(providers.includes("if (/^pr(-br)?$/i.test(value))"));
  assert.doesNotMatch(app, /function normalizeMtLang/);
});

test("the editor delegates translation through the provider registry", () => {
  assert.match(app, /registry\.translate\(validProvider\(provider\)/);
  assert.match(app, /sourceLanguage: "en"/);
  assert.match(app, /targetLanguage: target/);
});

test("provider selection is visible and remembered", () => {
  assert.match(html, /id="mtProvider"/);
  assert.match(app, /necesse-translator.mt-provider.v1/);
  assert.match(app, /setPreferredProvider\(state\.mtProvider\)/);
  assert.match(app, /providerSelect.disabled = providerSelect.options.length < 2/);
});

test("hosted and standalone builds load provider code before the app", () => {
  assert.ok(html.indexOf("scripts/mt/providers.js") < html.indexOf("scripts/app.js"));
  assert.match(build, /scripts\/mt\/providers\.js/);
  assert.match(build, /providers.trimEnd()/);
});
