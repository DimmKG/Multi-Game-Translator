import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchCatalog,
  fetchGlossary,
  loadLocalGlossary,
  normalizeCatalog,
  normalizeGlossary,
  parseJsonDocument
} from "../src/scripts/glossary/loader.js";

const glossary = {
  format: "necesse-glossary",
  version: 1,
  id: "necesse.bg.core",
  name: "Necesse Bulgarian Core",
  sourceLanguage: "en",
  targetLanguage: "bg",
  entries: [
    {
      source: "Caveling",
      target: "Пещерник",
      forms: ["Пещерникът", "Пещерника", "Пещерници"],
      forbidden: ["Пещерняк"]
    }
  ]
};

test("normalizes glossary defaults, forms and frozen data", () => {
  const result = normalizeGlossary(glossary);
  assert.equal(result.entries[0].status, "approved");
  assert.equal(result.entries[0].wholeWord, true);
  assert.equal(result.entries[0].caseSensitive, false);
  assert.deepEqual(result.entries[0].forms, glossary.entries[0].forms);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.entries));
  assert.ok(Object.isFrozen(result.entries[0].forms));
});

test("rejects duplicate grammatical forms", () => {
  assert.throws(() => normalizeGlossary({
    ...glossary,
    entries: [{ source: "Settler", target: "Заселник", forms: ["Заселникът", "Заселникът"] }]
  }), /forms must not contain duplicates/);
});

test("resolves catalog URLs relative to the catalog response", () => {
  const result = normalizeCatalog({
    format: "necesse-glossary-catalog",
    version: 1,
    glossaries: [{
      id: glossary.id,
      name: glossary.name,
      sourceLanguage: "en",
      targetLanguage: "bg",
      url: "./bg/core.json"
    }]
  }, "https://example.invalid/catalog.json");
  assert.equal(result.glossaries[0].url, "https://example.invalid/bg/core.json");
});

test("rejects duplicate catalog IDs", () => {
  const item = { id: "duplicate", name: "Duplicate", sourceLanguage: "en", targetLanguage: "bg", url: "one.json" };
  assert.throws(() => normalizeCatalog({
    format: "necesse-glossary-catalog",
    version: 1,
    glossaries: [item, { ...item, url: "two.json" }]
  }), /Duplicate glossary id/);
});

test("parses UTF-8 BOM JSON", () => {
  assert.deepEqual(parseJsonDocument("\uFEFF{\"ok\":true}"), { ok: true });
});

test("loads a local glossary through the File-compatible interface", async () => {
  const result = await loadLocalGlossary({ name: "local.json", text: async () => JSON.stringify(glossary) });
  assert.equal(result.id, glossary.id);
  assert.deepEqual(result.entries[0].forms, glossary.entries[0].forms);
});

test("fetches catalog and glossary without cache", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      url,
      json: async () => url.endsWith("catalog.json") ? {
        format: "necesse-glossary-catalog",
        version: 1,
        glossaries: []
      } : glossary
    };
  };
  await fetchCatalog("https://example.invalid/catalog.json", fetchImpl);
  await fetchGlossary("https://example.invalid/glossary.json", fetchImpl);
  assert.deepEqual(calls.map(call => call.options.cache), ["no-store", "no-store"]);
});

test("reports HTTP failures", async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(fetchCatalog("https://example.invalid/catalog.json", fetchImpl), /HTTP 503/);
});
