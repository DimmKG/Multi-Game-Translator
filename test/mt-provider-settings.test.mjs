import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/mt/provider-settings.js", import.meta.url), "utf8");

test("provider secrets are memory-only", () => {
  assert.match(source, /const secrets = new Map\(\)/);
  assert.match(source, /secretPersistence: "memory-only"/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*secret/i);
  assert.doesNotMatch(source, /document\.cookie/i);
});

test("only non-secret provider settings are persisted", () => {
  assert.match(source, /function persistPublicSettings\(\)/);
  assert.match(source, /JSON\.stringify\(publicSettings\)/);
  assert.match(source, /field\.type === "secret"/);
  assert.match(source, /throw new TypeError\("Unknown non-secret provider setting\."\)/);
});

test("provider settings schemas separate text and secret fields", () => {
  assert.match(source, /const type = field\.type === "secret" \? "secret" : "text"/);
  assert.match(source, /defaultValue: type === "secret" \? ""/);
  assert.match(source, /function resolve\(providerId\)/);
});

const providers = await readFile(new URL("../src/scripts/mt/providers.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/scripts/mt/provider-settings-ui.js", import.meta.url), "utf8");
const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");

test("providers declare settings and receive resolved values", () => {
  assert.match(providers, /NecesseMtProviderSettings\?\.define\(id, settings\)/);
  assert.match(providers, /NecesseMtProviderSettings\?\.resolve\(provider\.id\)/);
  assert.match(providers, /signal: request\.signal,\s*settings/);
});

test("Settings renders provider-declared fields without persisting secrets", () => {
  assert.match(ui, /field\.type === "secret" \? "password" : "text"/);
  assert.match(ui, /store\?\.setSecret/);
  assert.match(ui, /store\?\.setPublic/);
  assert.doesNotMatch(ui, /localStorage|document\.cookie/);
});

test("hosted and standalone builds load provider settings", () => {
  assert.match(html, /provider-settings\.js/);
  assert.match(html, /provider-settings-ui\.js/);
  assert.match(build, /providerSettings/);
  assert.match(build, /providerSettingsUi/);
});

const vaultUi = await readFile(new URL("../src/scripts/mt/secret-vault-ui.js", import.meta.url), "utf8");

test("provider secret snapshots stay separate from public persistence", () => {
  assert.match(source, /function exportSecrets\(\)/);
  assert.match(source, /function importSecrets\(snapshot/);
  assert.match(source, /function secretCount\(\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(exportSecrets\(\)\)/);
});

test("encrypted vault controls use the vault API and never persist passwords", () => {
  assert.match(vaultUi, /vault\.encrypt\(store\.exportSecrets\(\), passphrase\)/);
  assert.match(vaultUi, /vault\.decrypt\(await file\.text\(\), passphrase\)/);
  assert.match(vaultUi, /store\.importSecrets\(secrets, \{ replace: true \}\)/);
  assert.doesNotMatch(vaultUi, /localStorage|document\.cookie|sessionStorage/);
});
