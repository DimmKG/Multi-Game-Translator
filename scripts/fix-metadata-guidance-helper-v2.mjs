import { readFile, writeFile, unlink } from "node:fs/promises";

const path = "scripts/apply-metadata-guidance-integration.mjs";
let source = await readFile(path, "utf8");
source = source.replace(
  'new URL(`../src/scripts/i18n/locales/${code}.json`, import.meta.url)',
  'new URL("../src/scripts/i18n/locales/" + code + ".json", import.meta.url)'
);
source = source.replace('`${code}: ${key}`', 'code + ": " + key');
source = source.replace(
  /  style\.textContent = .*metadata-guidance::before.*\n/,
  '  style.textContent = ".metadata-guidance{margin:8px 0 10px;padding:8px 10px;border-left:3px solid var(--accent);border-radius:4px;background:color-mix(in srgb,var(--accent) 8%,transparent);color:var(--ink-dim);font-size:12px;line-height:1.45}";\n'
);
source = source.replace(
  '    hint.textContent = currentLocaleText(rule.messageKey);',
  '    hint.textContent = "ⓘ " + currentLocaleText(rule.messageKey);'
);
source = source.replace(
  '  assert.doesNotMatch(source, /textarea\\.value|buildLang|download\\(/);',
  '  assert.equal(source.includes("textarea.value") || source.includes("buildLang") || source.includes("download("), false);'
);
await writeFile(path, source, "utf8");
await unlink(new URL(import.meta.url));
console.log("Metadata guidance helper escaping corrected.");
