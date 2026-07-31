"use strict";

const GLOSSARY_FORMAT = "necesse-glossary";
const CATALOG_FORMAT = "necesse-glossary-catalog";
const FORMAT_VERSION = 1;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const ENTRY_STATUSES = new Set(["approved", "draft", "deprecated", "context-dependent"]);

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

function assertLanguage(value, label) {
  assertString(value, label);
  if (!LANGUAGE_PATTERN.test(value)) {
    throw new TypeError(`${label} is not a supported language tag.`);
  }
}

function assertStringArray(value, label) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || item.length === 0)) {
    throw new TypeError(`${label} must be an array of non-empty strings.`);
  }
  if (new Set(value).size !== value.length) {
    throw new TypeError(`${label} must not contain duplicates.`);
  }
}

function normalizeEntry(entry, index) {
  assertObject(entry, `entries[${index}]`);
  assertString(entry.source, `entries[${index}].source`);
  assertString(entry.target, `entries[${index}].target`);
  assertStringArray(entry.alternatives, `entries[${index}].alternatives`);
  assertStringArray(entry.forbidden, `entries[${index}].forbidden`);

  const status = entry.status ?? "approved";
  if (!ENTRY_STATUSES.has(status)) {
    throw new TypeError(`entries[${index}].status is not supported.`);
  }

  return Object.freeze({
    source: entry.source,
    target: entry.target,
    alternatives: Object.freeze([...(entry.alternatives ?? [])]),
    forbidden: Object.freeze([...(entry.forbidden ?? [])]),
    caseSensitive: entry.caseSensitive ?? false,
    wholeWord: entry.wholeWord ?? true,
    status,
    category: entry.category ?? "",
    context: entry.context ?? "",
    note: entry.note ?? ""
  });
}

export function parseJsonDocument(text, label = "JSON document") {
  if (typeof text !== "string") throw new TypeError(`${label} must be text.`);
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new SyntaxError(`${label} is not valid JSON: ${error.message}`);
  }
}

export function normalizeGlossary(input) {
  assertObject(input, "Glossary");
  if (input.format !== GLOSSARY_FORMAT || input.version !== FORMAT_VERSION) {
    throw new TypeError("Unsupported glossary format or version.");
  }
  assertString(input.id, "Glossary id");
  if (!ID_PATTERN.test(input.id)) throw new TypeError("Glossary id is invalid.");
  assertString(input.name, "Glossary name");
  assertLanguage(input.sourceLanguage, "Glossary sourceLanguage");
  assertLanguage(input.targetLanguage, "Glossary targetLanguage");
  if (!Array.isArray(input.entries)) throw new TypeError("Glossary entries must be an array.");

  return Object.freeze({
    format: GLOSSARY_FORMAT,
    version: FORMAT_VERSION,
    id: input.id,
    name: input.name,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    game: input.game ?? "",
    authors: Object.freeze([...(input.authors ?? [])]),
    updatedAt: input.updatedAt ?? "",
    entries: Object.freeze(input.entries.map(normalizeEntry))
  });
}

export function normalizeCatalog(input, baseUrl) {
  assertObject(input, "Glossary catalog");
  if (input.format !== CATALOG_FORMAT || input.version !== FORMAT_VERSION) {
    throw new TypeError("Unsupported glossary catalog format or version.");
  }
  if (!Array.isArray(input.glossaries)) throw new TypeError("Catalog glossaries must be an array.");

  const ids = new Set();
  const glossaries = input.glossaries.map((item, index) => {
    assertObject(item, `glossaries[${index}]`);
    assertString(item.id, `glossaries[${index}].id`);
    if (!ID_PATTERN.test(item.id)) throw new TypeError(`glossaries[${index}].id is invalid.`);
    if (ids.has(item.id)) throw new TypeError(`Duplicate glossary id: ${item.id}`);
    ids.add(item.id);
    assertString(item.name, `glossaries[${index}].name`);
    assertLanguage(item.sourceLanguage, `glossaries[${index}].sourceLanguage`);
    assertLanguage(item.targetLanguage, `glossaries[${index}].targetLanguage`);
    assertString(item.url, `glossaries[${index}].url`);

    return Object.freeze({
      id: item.id,
      name: item.name,
      sourceLanguage: item.sourceLanguage,
      targetLanguage: item.targetLanguage,
      url: baseUrl ? new URL(item.url, baseUrl).href : item.url,
      enabled: item.enabled ?? true
    });
  });

  return Object.freeze({
    format: CATALOG_FORMAT,
    version: FORMAT_VERSION,
    glossaries: Object.freeze(glossaries)
  });
}

export async function readJsonFile(file, kind = "document") {
  if (!file || typeof file.text !== "function") {
    throw new TypeError(`A readable ${kind} file is required.`);
  }
  return parseJsonDocument(await file.text(), file.name || kind);
}

export async function loadLocalGlossary(file) {
  return normalizeGlossary(await readJsonFile(file, "glossary"));
}

export async function fetchCatalog(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch is not available in this environment.");
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}.`);
  return normalizeCatalog(await response.json(), response.url || url);
}

export async function fetchGlossary(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch is not available in this environment.");
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Glossary request failed with HTTP ${response.status}.`);
  return normalizeGlossary(await response.json());
}

export const glossaryFormat = Object.freeze({
  glossary: GLOSSARY_FORMAT,
  catalog: CATALOG_FORMAT,
  version: FORMAT_VERSION
});
