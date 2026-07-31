import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "src/scripts/i18n/locales.js");
const source = await readFile(path, "utf8");
const context = vm.createContext(Object.create(null));
vm.runInContext(`${source}\n;globalThis.__I18N__ = I18N;`, context, { filename: path, timeout: 1000 });
const locales = context.__I18N__;
if (!locales || typeof locales !== "object" || Array.isArray(locales)) throw new Error("Locale source must define an I18N object.");
if (!locales.en) throw new Error("The English fallback locale is missing.");
const baseKeys = Object.keys(locales.en);
const baseSet = new Set(baseKeys);
const tokens = value => [...String(value).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(x => x[1]).sort();
const errors = [];
for (const [code, messages] of Object.entries(locales)) {
  if (!messages || typeof messages !== "object" || Array.isArray(messages)) { errors.push(`${code}: locale must be an object`); continue; }
  const keys = Object.keys(messages);
  const keySet = new Set(keys);
  const missing = baseKeys.filter(key => !keySet.has(key));
  const unknown = keys.filter(key => !baseSet.has(key));
  if (missing.length) errors.push(`${code}: missing keys: ${missing.join(", ")}`);
  if (unknown.length) errors.push(`${code}: unknown keys: ${unknown.join(", ")}`);
  for (const key of baseKeys) {
    if (!keySet.has(key)) continue;
    if (typeof messages[key] !== "string") { errors.push(`${code}.${key}: value must be a string`); continue; }
    if (tokens(locales.en[key]).join("\0") !== tokens(messages[key]).join("\0")) errors.push(`${code}.${key}: placeholders differ`);
  }
}
if (errors.length) { console.error("Interface locale validation failed:\n" + errors.map(x => `- ${x}`).join("\n")); process.exit(1); }
console.log(`Validated ${Object.keys(locales).length} interface locales with ${baseKeys.length} keys each.`);
