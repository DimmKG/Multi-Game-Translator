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
