const GLOSSARY_FORMAT = "necesse-glossary";
const CATALOG_FORMAT = "necesse-glossary-catalog";
const FORMAT_VERSION = 1;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const ENTRY_STATUSES = new Set(["approved", "draft", "deprecated", "context-dependent"]);

export interface NormalizedGlossaryEntry {
  source: string;
  target: string;
  forms: readonly string[];
  alternatives: readonly string[];
  forbidden: readonly string[];
  caseSensitive: boolean;
  wholeWord: boolean;
  status: string;
  category: string;
  context: string;
  note: string;
}

export interface NormalizedGlossary {
  format: typeof GLOSSARY_FORMAT;
  version: typeof FORMAT_VERSION;
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  game: string;
  authors: readonly string[];
  updatedAt: string;
  entries: readonly NormalizedGlossaryEntry[];
}

export interface CatalogItem {
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  url: string;
  enabled: boolean;
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

function assertLanguage(value: unknown, label: string) {
  assertString(value, label);
  if (!LANGUAGE_PATTERN.test(value))
    throw new TypeError(`${label} is not a supported language tag.`);
}

function assertStringArray(value: unknown, label: string) {
  if (value === undefined) return;
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new TypeError(`${label} must be an array of non-empty strings.`);
  }
  if (new Set(value).size !== value.length)
    throw new TypeError(`${label} must not contain duplicates.`);
}

function normalizeEntry(entry: unknown, index: number): NormalizedGlossaryEntry {
  assertObject(entry, `entries[${index}]`);
  assertString(entry.source, `entries[${index}].source`);
  assertString(entry.target, `entries[${index}].target`);
  assertStringArray(entry.forms, `entries[${index}].forms`);
  assertStringArray(entry.alternatives, `entries[${index}].alternatives`);
  assertStringArray(entry.forbidden, `entries[${index}].forbidden`);

  const status = (entry.status as string | undefined) ?? "approved";
  if (!ENTRY_STATUSES.has(status))
    throw new TypeError(`entries[${index}].status is not supported.`);

  return Object.freeze({
    source: entry.source,
    target: entry.target,
    forms: Object.freeze([...((entry.forms as string[]) ?? [])]),
    alternatives: Object.freeze([...((entry.alternatives as string[]) ?? [])]),
    forbidden: Object.freeze([...((entry.forbidden as string[]) ?? [])]),
    caseSensitive: (entry.caseSensitive as boolean | undefined) ?? false,
    wholeWord: (entry.wholeWord as boolean | undefined) ?? true,
    status,
    category: (entry.category as string | undefined) ?? "",
    context: (entry.context as string | undefined) ?? "",
    note: (entry.note as string | undefined) ?? "",
  });
}

export function parseJsonDocument(text: string, label = "JSON document") {
  if (typeof text !== "string") throw new TypeError(`${label} must be text.`);
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new SyntaxError(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function normalizeGlossary(input: unknown): NormalizedGlossary {
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
    sourceLanguage: input.sourceLanguage as string,
    targetLanguage: input.targetLanguage as string,
    game: (input.game as string | undefined) ?? "",
    authors: Object.freeze([...((input.authors as string[]) ?? [])]),
    updatedAt: (input.updatedAt as string | undefined) ?? "",
    entries: Object.freeze(input.entries.map(normalizeEntry)),
  });
}

export function normalizeCatalog(input: unknown, baseUrl?: string) {
  assertObject(input, "Glossary catalog");
  if (input.format !== CATALOG_FORMAT || input.version !== FORMAT_VERSION) {
    throw new TypeError("Unsupported glossary catalog format or version.");
  }
  if (!Array.isArray(input.glossaries)) throw new TypeError("Catalog glossaries must be an array.");

  const ids = new Set<string>();
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
      sourceLanguage: item.sourceLanguage as string,
      targetLanguage: item.targetLanguage as string,
      url: baseUrl ? new URL(item.url, baseUrl).href : item.url,
      enabled: (item.enabled as boolean | undefined) ?? true,
    });
  });
  return Object.freeze({
    format: CATALOG_FORMAT,
    version: FORMAT_VERSION,
    glossaries: Object.freeze(glossaries),
  });
}

export async function loadLocalGlossary(file: File) {
  const text = await file.text();
  return normalizeGlossary(parseJsonDocument(text, file.name || "glossary"));
}

export async function fetchCatalog(url: string, fetchImpl: typeof fetch = globalThis.fetch) {
  if (typeof fetchImpl !== "function")
    throw new TypeError("Fetch is not available in this environment.");
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}.`);
  return normalizeCatalog(await response.json(), response.url || url);
}

export async function fetchGlossary(url: string, fetchImpl: typeof fetch = globalThis.fetch) {
  if (typeof fetchImpl !== "function")
    throw new TypeError("Fetch is not available in this environment.");
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Glossary request failed with HTTP ${response.status}.`);
  return normalizeGlossary(await response.json());
}

export const glossaryFormat = Object.freeze({
  glossary: GLOSSARY_FORMAT,
  catalog: CATALOG_FORMAT,
  version: FORMAT_VERSION,
});
