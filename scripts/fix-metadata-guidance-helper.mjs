import { readFile, writeFile, unlink } from "node:fs/promises";

const path = "scripts/apply-metadata-guidance-integration.mjs";
let source = await readFile(path, "utf8");
source = source.replace(
  'new URL(`../src/scripts/i18n/locales/${code}.json`, import.meta.url)',
  'new URL("../src/scripts/i18n/locales/" + code + ".json", import.meta.url)'
);
source = source.replace('`${code}: ${key}`', 'code + ": " + key');
await writeFile(path, source, "utf8");
await unlink(new URL(import.meta.url));
console.log("Metadata guidance helper fixed.");
