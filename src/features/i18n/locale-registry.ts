// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LocaleManifestEntry } from "./types";

const localeModules = import.meta.glob("../../locales/*.json", {
  eager: true,
  import: "default",
}) as Record<string, LocaleDefinition>;

export interface LocaleDefinition {
  code: string;
  name: string;
  nativeName: string;
  reviewed?: boolean;
  messages: Record<string, string>;
}

const registry = new Map<string, LocaleDefinition>();
const messageTables = new Map<string, Record<string, string>>();

function loadBuiltIns() {
  const entries = Object.entries(localeModules)
    .filter(([path]) => !path.endsWith("/manifest.json"))
    .map(([, locale]) => locale)
    .filter((locale) => locale && typeof locale.code === "string" && locale.messages);
  const english = entries.find((locale) => locale.code === "en");
  if (!english) throw new Error("English locale is required");
  registerLocale(english);
  for (const locale of entries) {
    if (locale.code === "en") continue;
    registerLocale(locale);
  }
}

export function registerLocale(locale: LocaleDefinition) {
  if (!locale?.code || !locale.messages) {
    throw new TypeError("A valid interface locale is required.");
  }
  const english = messageTables.get("en");
  if (locale.code !== "en" && !english) {
    throw new Error("The English locale must be registered first.");
  }
  const messages =
    locale.code === "en" ? { ...locale.messages } : { ...(english || {}), ...locale.messages };
  messageTables.set(locale.code, messages);
  registry.set(locale.code, {
    ...locale,
    messages,
  });
}

export function getLocale(code: string) {
  return registry.get(code) || null;
}

export function getAllLocales(): LocaleManifestEntry[] {
  return [...registry.values()].map((locale) => ({
    code: locale.code,
    name: locale.name,
    nativeName: locale.nativeName,
    reviewed: Boolean(locale.reviewed),
  }));
}

export function isBuiltInLocale(code: string) {
  return registry.has(code);
}

export function translateMessage(
  languageCode: string,
  key: string,
  vars?: Record<string, string | number>,
) {
  const table = messageTables.get(languageCode) || messageTables.get("en") || {};
  let text = table[key] ?? messageTables.get("en")?.[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  // Simple plural: key.one / key.other when exact count === 1
  if (vars && typeof vars.n === "number") {
    const pluralKey = vars.n === 1 ? `${key}.one` : `${key}.other`;
    const plural = table[pluralKey] ?? messageTables.get("en")?.[pluralKey];
    if (plural) {
      text = plural;
      for (const [name, value] of Object.entries(vars)) {
        text = text.split(`{${name}}`).join(String(value));
      }
    }
  }
  return text;
}

export function applyInstallableLocale(locale: LocaleDefinition) {
  if (["en", "bg", "ru"].includes(locale.code)) {
    throw new TypeError(`Built-in locale “${locale.code}” cannot be replaced.`);
  }
  registerLocale(locale);
}

loadBuiltIns();
