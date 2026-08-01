import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve("src/scripts/i18n/locales");
const outputBundle = resolve("src/scripts/i18n/built-in-locales.generated.js");
const outputManifest = resolve(directory, "manifest.json");
const files = (await readdir(directory))
  .filter(name => name.endsWith(".json") && name !== "manifest.json")
  .sort((a, b) => a === "en.json" ? -1 : b === "en.json" ? 1 : a.localeCompare(b));

if (!files.length || files[0] !== "en.json") throw new Error("The English locale must exist and load first.");

const locales = [];
const codes = new Set();
for (const filename of files) {
  const locale = JSON.parse(await readFile(resolve(directory, filename), "utf8"));
  if (!locale || typeof locale !== "object" || Array.isArray(locale)) throw new Error(filename + ": locale must be an object");
  if (typeof locale.code !== "string" || locale.code + ".json" !== filename) throw new Error(filename + ": invalid or mismatched code");
  if (codes.has(locale.code)) throw new Error(filename + ": duplicate code " + locale.code);
  if (typeof locale.name !== "string" || typeof locale.nativeName !== "string") throw new Error(filename + ": invalid names");
  if (typeof locale.reviewed !== "boolean") throw new Error(filename + ": reviewed must be boolean");
  if (!locale.messages || typeof locale.messages !== "object" || Array.isArray(locale.messages)) throw new Error(filename + ": messages must be an object");
  codes.add(locale.code);
  locales.push(locale);
}

const englishKeys = new Set(Object.keys(locales[0].messages));
for (const locale of locales) {
  for (const [key, value] of Object.entries(locale.messages)) {
    if (typeof value !== "string") throw new Error(locale.code + ": message " + key + " must be a string");
    if (locale.code !== "en" && !englishKeys.has(key)) throw new Error(locale.code + ": unknown message key " + key);
  }
}

const manifest = {
  format: "necesse-built-in-locales",
  version: 1,
  generatedFrom: "src/scripts/i18n/locales/*.json",
  locales: locales.map(locale => ({
    code: locale.code,
    name: locale.name,
    nativeName: locale.nativeName,
    reviewed: locale.reviewed,
    file: locale.code + ".json",
    messageCount: Object.keys(locale.messages).length
  }))
};
await writeFile(outputManifest, JSON.stringify(manifest, null, 2) + "\n", "utf8");

const header = [
  '"use strict";',
  "",
  "/* GENERATED FILE — DO NOT EDIT.",
  " * Source: src/scripts/i18n/locales/*.json",
  " * English, Bulgarian and Russian are human-maintained.",
  " * All other translations were generated with AI and remain provisional",
  " * until reviewed and corrected by native speakers.",
  " */",
  ""
].join("\n");
const registrations = locales.map(locale => "globalThis.NecesseLocales.register(" + JSON.stringify(locale, null, 2) + ");").join("\n\n");
await writeFile(outputBundle, header + registrations + "\n", "utf8");

console.log("Generated locale manifest and runtime bundle for " + locales.length + " locales.");
