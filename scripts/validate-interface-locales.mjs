import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(".");
const directory = resolve(root, "interface-locales");
const builtInDirectory = resolve(root, "src/locales");
const manifest = JSON.parse(await readFile(resolve(builtInDirectory, "manifest.json"), "utf8"));
const english = JSON.parse(await readFile(resolve(builtInDirectory, "en.json"), "utf8"));
const englishKeys = new Set(Object.keys(english.messages));
const builtins = new Set(manifest.locales.map((locale) => locale.code));
const codePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const failures = [];
let checked = 0;

async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(child)));
    else if (extname(entry.name).toLowerCase() === ".json") files.push(child);
  }
  return files;
}

for (const file of await filesUnder(directory)) {
  checked++;
  let locale;
  try {
    locale = JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    failures.push(`${file}: invalid JSON: ${error.message}`);
    continue;
  }

  if (!locale || typeof locale !== "object" || Array.isArray(locale))
    failures.push(`${file}: package must be an object`);
  if (locale.format !== "necesse-interface-locale" || locale.version !== 1)
    failures.push(`${file}: unsupported format or version`);
  if (typeof locale.code !== "string" || !codePattern.test(locale.code))
    failures.push(`${file}: invalid language code`);
  if (builtins.has(locale.code))
    failures.push(`${file}: built-in language codes cannot be replaced`);
  if (typeof locale.name !== "string" || !locale.name.trim())
    failures.push(`${file}: name is required`);
  if (typeof locale.nativeName !== "string" || !locale.nativeName.trim())
    failures.push(`${file}: nativeName is required`);
  if (!locale.messages || typeof locale.messages !== "object" || Array.isArray(locale.messages)) {
    failures.push(`${file}: messages must be an object`);
    continue;
  }
  const entries = Object.entries(locale.messages);
  if (!entries.length) failures.push(`${file}: messages must not be empty`);
  for (const [key, value] of entries) {
    if (!englishKeys.has(key)) failures.push(`${file}: unknown message key ${key}`);
    if (typeof value !== "string") failures.push(`${file}: message ${key} must be a string`);
  }
}

if (failures.length) {
  console.error(
    "Interface locale validation failed:\n" + failures.map((item) => `- ${item}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${checked} interface locale package${checked === 1 ? "" : "s"} against ${builtins.size} built-in JSON locales.`,
  );
}
