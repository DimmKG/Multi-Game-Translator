import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(".");
const i18nDir = resolve(root, "src/scripts/i18n");
const localeDir = resolve(i18nDir, "locales");

function extractObject(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error("Could not extract object after " + startMarker);
  return vm.runInNewContext("(" + source.slice(start + startMarker.length, end).trim() + ")", Object.create(null));
}

const localeSource = await readFile(resolve(i18nDir, "locales.js"), "utf8");
const settingsSource = await readFile(resolve(i18nDir, "settings-messages.js"), "utf8");
const bootstrapSource = await readFile(resolve(i18nDir, "locale-bootstrap.js"), "utf8");

const context = Object.create(null);
vm.createContext(context);
vm.runInContext(localeSource + "\nglobalThis.__I18N = I18N;", context);
const locales = context.__I18N;
const extensions = extractObject(bootstrapSource, "const extensions =", ";\n\n  for (const code");
const settings = extractObject(settingsSource, "const messages =", ";\n\n  for (const [code");

for (const [code, messages] of Object.entries(extensions)) locales[code] = Object.assign({}, locales[code] || {}, messages);
for (const [code, messages] of Object.entries(settings)) locales[code] = Object.assign({}, locales[code] || {}, messages);

const codes = Object.keys(locales).sort((a, b) => a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b));
await rm(localeDir, { recursive: true, force: true });
await mkdir(localeDir, { recursive: true });

function displayName(code, locale) {
  try { return new Intl.DisplayNames([locale], { type: "language" }).of(code) || code; }
  catch { return code; }
}

for (const code of codes) {
  const lines = [
    '"use strict";',
    "",
    "globalThis.NecesseLocales.register({",
    "  code: " + JSON.stringify(code) + ",",
    "  name: " + JSON.stringify(displayName(code, "en")) + ",",
    "  nativeName: " + JSON.stringify(displayName(code, code)) + ",",
    "  reviewed: " + String(["en", "bg", "ru"].includes(code)) + ",",
    "  messages: " + JSON.stringify(locales[code], null, 2),
    "});",
    ""
  ];
  await writeFile(resolve(localeDir, code + ".js"), lines.join("\n"), "utf8");
}

console.log("Generated " + codes.length + " built-in locale files: " + codes.join(", "));
