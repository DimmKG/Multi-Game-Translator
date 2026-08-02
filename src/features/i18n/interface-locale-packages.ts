// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  applyInstallableLocale,
  getEnglishMessageKeys,
  getEnglishMessages,
  isBuiltInLocale,
  removeInstallableLocale,
  type LocaleDefinition,
} from "./locale-registry";

const LOCALE_FORMAT = "necesse-interface-locale";
const LOCALE_VERSION = 1;
const STORAGE_KEY = "necesse-translator.interface-locales.v1";
const CODE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export interface InterfaceLocalePackage extends LocaleDefinition {
  format: typeof LOCALE_FORMAT;
  version: typeof LOCALE_VERSION;
  authors: readonly string[];
  updatedAt: string;
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

export function normalizeInterfaceLocale(input: unknown): InterfaceLocalePackage {
  assertObject(input, "Interface locale");
  if (input.format !== LOCALE_FORMAT || input.version !== LOCALE_VERSION) {
    throw new TypeError("Unsupported interface locale format or version.");
  }
  if (typeof input.code !== "string" || !CODE_PATTERN.test(input.code)) {
    throw new TypeError("Interface locale code is invalid.");
  }
  if (isBuiltInLocale(input.code)) {
    throw new TypeError(`Built-in locale “${input.code}” cannot be replaced.`);
  }
  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new TypeError("Interface locale name is required.");
  }
  if (typeof input.nativeName !== "string" || !input.nativeName.trim()) {
    throw new TypeError("Interface locale nativeName is required.");
  }
  assertObject(input.messages, "Interface locale messages");

  const knownKeys = getEnglishMessageKeys();
  const messages: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.messages)) {
    if (!knownKeys.has(key)) throw new TypeError(`Unknown interface message key: ${key}`);
    if (typeof value !== "string") {
      throw new TypeError(`Interface message “${key}” must be a string.`);
    }
    messages[key] = value;
  }
  if (!Object.keys(messages).length) {
    throw new TypeError("Interface locale must contain at least one message.");
  }

  const authors = Array.isArray(input.authors)
    ? input.authors.filter(
        (author): author is string => typeof author === "string" && Boolean(author.trim()),
      )
    : [];

  return Object.freeze({
    format: LOCALE_FORMAT,
    version: LOCALE_VERSION,
    code: input.code,
    name: input.name.trim(),
    nativeName: input.nativeName.trim(),
    reviewed: false,
    authors: Object.freeze(authors),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : "",
    messages: Object.freeze(messages),
  });
}

function saveInstalled(locales: readonly InterfaceLocalePackage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locales));
}

export function restoreInstalledInterfaceLocales() {
  const restored: InterfaceLocalePackage[] = [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return restored;
    for (const item of parsed) {
      try {
        const locale = normalizeInterfaceLocale(item);
        applyInstallableLocale(locale);
        restored.push(locale);
      } catch {
        // Ignore stale or invalid packages without preventing application startup.
      }
    }
  } catch {
    return restored;
  }
  return restored;
}

export async function readInterfaceLocaleFile(file: File) {
  const text = (await file.text()).replace(/^\uFEFF/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new SyntaxError(
      `Interface locale is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return normalizeInterfaceLocale(parsed);
}

export function installInterfaceLocale(
  locales: readonly InterfaceLocalePackage[],
  locale: InterfaceLocalePackage,
) {
  const replaced = locales.some((item) => item.code === locale.code);
  const next = replaced
    ? locales.map((item) => (item.code === locale.code ? locale : item))
    : [...locales, locale];
  applyInstallableLocale(locale);
  saveInstalled(next);
  return { locales: next, replaced };
}

export function uninstallInterfaceLocale(
  locales: readonly InterfaceLocalePackage[],
  code: string,
) {
  const next = locales.filter((locale) => locale.code !== code);
  removeInstallableLocale(code);
  saveInstalled(next);
  return next;
}

export function createEnglishInterfaceLocaleTemplate() {
  return {
    $schema: "../../schemas/interface-locale-v1.schema.json",
    format: LOCALE_FORMAT,
    version: LOCALE_VERSION,
    code: "xx",
    name: "Example language",
    nativeName: "Example language",
    authors: [],
    updatedAt: new Date().toISOString().slice(0, 10),
    messages: getEnglishMessages(),
  };
}
