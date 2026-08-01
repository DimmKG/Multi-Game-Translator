import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, "src/scripts/i18n/locales");
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
const files = manifest.locales.map(locale => locale.file);
const locales = [];
for (const file of files) locales.push(JSON.parse(await readFile(resolve(directory, file), "utf8")));

if (!locales.length || locales[0].code !== "en") throw new Error("The English fallback locale must load first.");
const english = locales[0];
const baseKeys = Object.keys(english.messages);
const baseSet = new Set(baseKeys);
const tokens = value => [...String(value).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort();
const errors = [];
const seen = new Set();

for (const locale of locales) {
  if (seen.has(locale.code)) errors.push(`${locale.code}: duplicate locale code`);
  seen.add(locale.code);
  if (!locale.messages || typeof locale.messages !== "object" || Array.isArray(locale.messages)) {
    errors.push(`${locale.code}: messages must be an object`);
    continue;
  }
  const keys = Object.keys(locale.messages);
  const unknown = keys.filter(key => !baseSet.has(key));
  if (unknown.length) errors.push(`${locale.code}: unknown keys: ${unknown.join(", ")}`);
  if (locale.reviewed && locale.code !== "en") {
    const missing = baseKeys.filter(key => !Object.hasOwn(locale.messages, key));
    if (missing.length) errors.push(`${locale.code}: reviewed locale is missing keys: ${missing.join(", ")}`);
  }
  for (const [key, value] of Object.entries(locale.messages)) {
    if (typeof value !== "string") {
      errors.push(`${locale.code}.${key}: value must be a string`);
      continue;
    }
    if (Object.hasOwn(english.messages, key) && tokens(english.messages[key]).join("\0") !== tokens(value).join("\0")) {
      errors.push(`${locale.code}.${key}: placeholders differ`);
    }
  }
}

if (errors.length) {
  console.error("Interface locale validation failed:\n" + errors.map(error => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Validated ${locales.length} built-in JSON locales against ${baseKeys.length} English keys.`);
