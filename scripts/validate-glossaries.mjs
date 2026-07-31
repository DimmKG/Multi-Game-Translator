import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const glossaryRoot = resolve(root, "glossaries");
const errors = [];

async function collectJson(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectJson(path));
    else if (extname(entry.name) === ".json") files.push(path);
  }
  return files;
}

function isLanguageTag(value) {
  return typeof value === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value);
}

function validateEntry(entry, file, index) {
  const where = `${file}: entries[${index}]`;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push(`${where} must be an object`);
    return;
  }
  if (typeof entry.source !== "string" || !entry.source.trim()) errors.push(`${where}.source is required`);
  if (typeof entry.target !== "string" || !entry.target.trim()) errors.push(`${where}.target is required`);
  for (const key of ["alternatives", "forbidden"]) {
    if (key in entry && (!Array.isArray(entry[key]) || entry[key].some(v => typeof v !== "string" || !v.trim()))) {
      errors.push(`${where}.${key} must contain non-empty strings`);
    }
  }
}

for (const path of await collectJson(glossaryRoot)) {
  const file = path.slice(root.length + 1).replaceAll("\\", "/");
  let data;
  try { data = JSON.parse(await readFile(path, "utf8")); }
  catch (error) { errors.push(`${file}: invalid JSON (${error.message})`); continue; }

  if (data.format === "necesse-glossary-catalog") {
    if (data.version !== 1) errors.push(`${file}: unsupported catalog version`);
    if (!Array.isArray(data.glossaries)) errors.push(`${file}: glossaries must be an array`);
    else {
      const ids = new Set();
      data.glossaries.forEach((item, index) => {
        const where = `${file}: glossaries[${index}]`;
        if (!item || typeof item !== "object") return errors.push(`${where} must be an object`);
        if (typeof item.id !== "string" || !item.id) errors.push(`${where}.id is required`);
        else if (ids.has(item.id)) errors.push(`${where}.id is duplicated`);
        else ids.add(item.id);
        if (!isLanguageTag(item.sourceLanguage)) errors.push(`${where}.sourceLanguage is invalid`);
        if (!isLanguageTag(item.targetLanguage)) errors.push(`${where}.targetLanguage is invalid`);
        if (typeof item.url !== "string" || !item.url) errors.push(`${where}.url is required`);
      });
    }
    continue;
  }

  if (data.format !== "necesse-glossary") {
    errors.push(`${file}: unknown format`);
    continue;
  }
  if (data.version !== 1) errors.push(`${file}: unsupported glossary version`);
  if (typeof data.id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(data.id)) errors.push(`${file}: invalid id`);
  if (!isLanguageTag(data.sourceLanguage)) errors.push(`${file}: invalid sourceLanguage`);
  if (!isLanguageTag(data.targetLanguage)) errors.push(`${file}: invalid targetLanguage`);
  if (!Array.isArray(data.entries)) errors.push(`${file}: entries must be an array`);
  else data.entries.forEach((entry, index) => validateEntry(entry, file, index));
}

if (errors.length) {
  console.error("Glossary validation failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Glossary files are valid.");
}
