export const LANGUAGE_OPTIONS = Object.freeze([
  ["ar", "العربية"],
  ["bg", "Български"],
  ["ca", "Català"],
  ["cs", "Čeština"],
  ["da", "Dansk"],
  ["de", "Deutsch"],
  ["en", "English"],
  ["es", "Español"],
  ["fi", "Suomi"],
  ["fr", "Français"],
  ["hr", "Hrvatski"],
  ["hu", "Magyar"],
  ["id", "Bahasa Indonesia"],
  ["it", "Italiano"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["lt", "Lietuvių"],
  ["nl", "Nederlands"],
  ["no", "Norsk"],
  ["pl", "Polski"],
  ["pt-BR", "Português (Brasil)"],
  ["pt-PT", "Português (Portugal)"],
  ["ru", "Русский"],
  ["se", "Svenska"],
  ["th", "ไทย"],
  ["tr", "Türkçe"],
  ["uk", "Українська"],
  ["vi", "Tiếng Việt"],
  ["zh-CN", "中文（简体）"],
  ["zh-TW", "中文（繁體）"],
] as const);

const RECOGNIZED = new Map(LANGUAGE_OPTIONS.map(([code]) => [code.toLowerCase(), code]));
const LEGACY_ALIASES = new Map([
  ["pr", "pt-BR"],
  ["pr-br", "pt-BR"],
  ["pt", "pt-BR"],
  ["zh-hk", "zh-TW"],
  ["nb-no", "no"],
  ["nn-no", "no"],
]);

/** Normalize a project/MT language code. Unknown names return empty string (no Russian default). */
export function normalizeProjectCode(value: string): string {
  const raw = String(value || "")
    .trim()
    .replace(/_/g, "-");
  if (!raw) return "";
  const lower = raw.toLowerCase();
  return LEGACY_ALIASES.get(lower) || RECOGNIZED.get(lower) || "";
}

export function codeFromFilename(filename: string): string {
  const name = String(filename || "")
    .trim()
    .replace(/^.*[\\/]/, "");
  if (!/\.lang$/i.test(name)) return "";
  const base = name
    .replace(/\.lang$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/_\d+_?/g, "");
  return normalizeProjectCode(base);
}

export function suggestedFilename(code: string): string {
  const normalized = normalizeProjectCode(code);
  return normalized ? `${normalized}.lang` : "";
}
