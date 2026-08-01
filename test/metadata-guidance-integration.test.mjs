import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { metadataGuidanceFor } from "../src/scripts/metadata-guidance.js";

test("metadata rules match the initial language keys", () => {
  assert.equal(metadataGuidanceFor({section:"lang", key:"localname"})?.messageKey, "metadata.localname");
  assert.equal(metadataGuidanceFor({section:"other", key:"engname"})?.messageKey, "metadata.engname");
  assert.equal(metadataGuidanceFor({section:"lang", key:"extrasymbols"})?.messageKey, "metadata.extrasymbols");
});

test("credits guidance is section-sensitive and normalized", () => {
  assert.equal(metadataGuidanceFor({section:"[LANG]", key:"Credits"})?.messageKey, "metadata.langCredits");
  assert.equal(metadataGuidanceFor({section:"ui", key:"credits"}), null);
  assert.equal(metadataGuidanceFor({section:"", key:"credits"}), null);
});

test("guidance uses a generic renderer outside editable values", async () => {
  const source = await readFile(new URL("../src/scripts/metadata-guidance.js", import.meta.url), "utf8");
  assert.match(source, /GUIDANCE_RULES/);
  assert.equal(source.includes('insertAdjacentElement("afterend", hint)'), true);
  assert.equal(source.includes("currentLocaleText(rule.messageKey)"), true);
  assert.equal(source.includes("textarea.value") || source.includes("buildLang") || source.includes("download("), false);
});

test("hosted and standalone builds include metadata guidance", async () => {
  const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
  const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");
  assert.equal(html.includes("scripts/metadata-guidance.js"), true);
  assert.match(build, /bundledMetadataGuidance/);
  assert.match(build, /metadataGuidanceTag/);
});

test("reviewed locales provide all metadata guidance messages", async () => {
  const keys = ["metadata.localname", "metadata.engname", "metadata.extrasymbols", "metadata.langCredits"];
  for (const code of ["en", "bg", "ru"]) {
    const data = JSON.parse(await readFile(new URL("../src/scripts/i18n/locales/" + code + ".json", import.meta.url), "utf8"));
    for (const key of keys) assert.equal(typeof data.messages[key], "string", code + ": " + key);
  }
});
