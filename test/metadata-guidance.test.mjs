import test from "node:test";
import assert from "node:assert/strict";
import {
  metadataGuidanceFor,
  metadataGuidanceRules
} from "../src/scripts/metadata-guidance.js";

test("known language metadata keys expose localized guidance ids", () => {
  assert.equal(metadataGuidanceFor({ key: "localname", section: "lang" })?.messageKey, "metadata.localname");
  assert.equal(metadataGuidanceFor({ key: "engname", section: "lang" })?.messageKey, "metadata.engname");
  assert.equal(metadataGuidanceFor({ key: "extrasymbols", section: "lang" })?.messageKey, "metadata.extrasymbols");
});

test("credits guidance is restricted to the lang section", () => {
  assert.equal(metadataGuidanceFor({ key: "credits", section: "lang" })?.messageKey, "metadata.langCredits");
  assert.equal(metadataGuidanceFor({ key: "credits", section: "general" }), null);
  assert.equal(metadataGuidanceFor({ key: "credits" }), null);
});

test("matching normalizes section brackets and casing", () => {
  assert.equal(metadataGuidanceFor({ key: "CREDITS", section: "[LANG]" })?.messageKey, "metadata.langCredits");
});

test("guidance is data-driven and extensible", () => {
  const rules = metadataGuidanceRules();
  assert.equal(rules.length, 4);
  assert.ok(rules.every(rule => typeof rule.key === "string" && typeof rule.messageKey === "string"));
});
