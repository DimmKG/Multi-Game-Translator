import { readFile, writeFile, unlink } from "node:fs/promises";

const modulePath = "src/scripts/metadata-guidance.js";
const indexPath = "src/index.html";
const buildPath = "scripts/build-standalone.mjs";
const testPath = "test/metadata-guidance-integration.test.mjs";
const workflowPath = ".github/workflows/validate.yml";

const moduleSource = `const GUIDANCE_RULES = Object.freeze([
  Object.freeze({ key: "localname", messageKey: "metadata.localname" }),
  Object.freeze({ key: "engname", messageKey: "metadata.engname" }),
  Object.freeze({ key: "extrasymbols", messageKey: "metadata.extrasymbols" }),
  Object.freeze({ section: "lang", key: "credits", messageKey: "metadata.langCredits" })
]);

function normalizePart(value) {
  return String(value || "").trim().replace(/^\\[|\\]$/g, "").toLowerCase();
}

export function metadataGuidanceFor(entry) {
  const key = normalizePart(entry?.key);
  const section = normalizePart(entry?.section);
  return GUIDANCE_RULES.find(rule => {
    if (normalizePart(rule.key) !== key) return false;
    return rule.section == null || normalizePart(rule.section) === section;
  }) || null;
}

export function metadataGuidanceRules() {
  return GUIDANCE_RULES;
}

function currentLocaleText(key) {
  const code = document.getElementById("uiLang")?.value || "en";
  return globalThis.I18N?.[code]?.[key] ?? globalThis.I18N?.en?.[key] ?? key;
}

function ensureStyle() {
  if (document.getElementById("metadataGuidanceStyle")) return;
  const style = document.createElement("style");
  style.id = "metadataGuidanceStyle";
  style.textContent = ".metadata-guidance{margin:8px 0 10px;padding:8px 10px;border-left:3px solid var(--accent);border-radius:4px;background:color-mix(in srgb,var(--accent) 8%,transparent);color:var(--ink-dim);font-size:12px;line-height:1.45}.metadata-guidance::before{content:\"ⓘ \";color:var(--accent);font-weight:700}";
  document.head.appendChild(style);
}

function renderMetadataGuidance() {
  const list = document.getElementById("list");
  if (!list) return;
  ensureStyle();
  let section = "";
  for (const node of list.children) {
    if (node.classList?.contains("sec-head")) {
      section = node.textContent || "";
      continue;
    }
    if (!node.classList?.contains("card")) continue;
    const rule = metadataGuidanceFor({ section, key: node.dataset.key });
    let hint = node.querySelector(":scope > .metadata-guidance");
    if (!rule) {
      hint?.remove();
      continue;
    }
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "metadata-guidance";
      const row = node.querySelector(":scope > .row1");
      row?.insertAdjacentElement("afterend", hint);
    }
    hint.textContent = currentLocaleText(rule.messageKey);
  }
}

function setupMetadataGuidance() {
  const list = document.getElementById("list");
  if (!list) return;
  const observer = new MutationObserver(renderMetadataGuidance);
  observer.observe(list, { childList: true });
  document.getElementById("uiLang")?.addEventListener("change", () => setTimeout(renderMetadataGuidance, 0));
  renderMetadataGuidance();
}

globalThis.NecesseMetadataGuidance = Object.freeze({
  metadataGuidanceFor,
  metadataGuidanceRules,
  render: renderMetadataGuidance
});

if (typeof document !== "undefined") setupMetadataGuidance();
`;
await writeFile(modulePath, moduleSource, "utf8");

let index = await readFile(indexPath, "utf8");
const moduleTag = '<script type="module" src="./scripts/metadata-guidance.js"></script>';
if (!index.includes(moduleTag)) {
  index = index.replace('<script src="./scripts/app.js"></script>', '<script src="./scripts/app.js"></script>\n' + moduleTag);
}
await writeFile(indexPath, index, "utf8");

let build = await readFile(buildPath, "utf8");
build = build.replace(
  "providers, app, newTranslation, settings",
  "providers, app, metadataGuidance, newTranslation, settings"
);
build = build.replace(
  '  readFile(resolve(source, "scripts/app.js"), "utf8"),\n  readFile(resolve(source, "scripts/new-translation.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/app.js"), "utf8"),\n  readFile(resolve(source, "scripts/metadata-guidance.js"), "utf8"),\n  readFile(resolve(source, "scripts/new-translation.js"), "utf8"),'
);
build = build.replace(
  'const bundledNewTranslation = `{\\n${stripModuleSyntax(newTranslation)}\\n}`;',
  'const bundledMetadataGuidance = `{\\n${stripModuleSyntax(metadataGuidance)}\\n}`;\nconst bundledNewTranslation = `{\\n${stripModuleSyntax(newTranslation)}\\n}`;'
);
build = build.replace(
  'const newTranslationTag = /<script\\b(?=[^>]*\\btype=["\']module["\'])(?=[^>]*\\bsrc=["\']\\.\\/scripts\\/new-translation\\.js["\'])[^>]*><\\/script>/i;',
  'const metadataGuidanceTag = /<script\\b(?=[^>]*\\btype=["\']module["\'])(?=[^>]*\\bsrc=["\']\\.\\/scripts\\/metadata-guidance\\.js["\'])[^>]*><\\/script>/i;\nconst newTranslationTag = /<script\\b(?=[^>]*\\btype=["\']module["\'])(?=[^>]*\\bsrc=["\']\\.\\/scripts\\/new-translation\\.js["\'])[^>]*><\\/script>/i;'
);
build = build.replace(
  '.replace(\'<script src="./scripts/app.js"></script>\', `<script>${combinedApp}</script>`)\n  .replace(newTranslationTag, `<script>${bundledNewTranslation}</script>`)',
  '.replace(\'<script src="./scripts/app.js"></script>\', `<script>${combinedApp}</script>`)\n  .replace(metadataGuidanceTag, `<script>${bundledMetadataGuidance}</script>`)\n  .replace(newTranslationTag, `<script>${bundledNewTranslation}</script>`)' 
);
if (!build.includes("bundledMetadataGuidance") || !build.includes("metadataGuidanceTag")) {
  throw new Error("Standalone metadata guidance integration was not applied.");
}
await writeFile(buildPath, build, "utf8");

const localeMessages = {
  en: {
    "metadata.localname": "Language name written in this language (for example, Български).",
    "metadata.engname": "Language name written in English (for example, Bulgarian).",
    "metadata.extrasymbols": "Additional characters that must be available in the game font. Keep this as a character list, not a sentence.",
    "metadata.langCredits": "Translator names shown in the language credits. Preserve the separator and formatting expected by Necesse."
  },
  bg: {
    "metadata.localname": "Името на езика, изписано на самия език (например Български).",
    "metadata.engname": "Името на езика, изписано на английски (например Bulgarian).",
    "metadata.extrasymbols": "Допълнителни знаци, които трябва да присъстват в шрифта на играта. Това е списък със знаци, а не изречение.",
    "metadata.langCredits": "Имената на преводачите в езиковите заслуги. Запази разделителя и формата, очаквани от Necesse."
  },
  ru: {
    "metadata.localname": "Название языка, написанное на самом языке (например Русский).",
    "metadata.engname": "Название языка, написанное на английском (например Russian).",
    "metadata.extrasymbols": "Дополнительные символы, которые должны присутствовать в игровом шрифте. Это список символов, а не предложение.",
    "metadata.langCredits": "Имена переводчиков в языковых титрах. Сохраните разделитель и формат, ожидаемые Necesse."
  }
};
for (const [code, messages] of Object.entries(localeMessages)) {
  const path = `src/scripts/i18n/locales/${code}.json`;
  const data = JSON.parse(await readFile(path, "utf8"));
  Object.assign(data.messages, messages);
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const testSource = `import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { metadataGuidanceFor } from "../src/scripts/metadata-guidance.js";

test("metadata rules match the initial language keys", () => {
  assert.equal(metadataGuidanceFor({section:"lang", key:"localname"})?.messageKey, "metadata.localname");
  assert.equal(metadataGuidanceFor({section:"other", key:"engname"})?.messageKey, "metadata.engname");
  assert.equal(metadataGuidanceFor({section:"lang", key:"extrasymbols"})?.messageKey, "metadata.extrasymbols");
});

test("credits guidance is section-sensitive and normalized", () => {
  assert.equal(metadataGuidanceFor({section:"[LANG]", key:"Credits"})?.messageKey, "metadata.langCredits");
  assert.equal(metadataGuidanceFor({section:"ui", key:"credits"}), null);
  assert.equal(metadataGuidanceFor({section:"", key:"credits"}), null);
});

test("guidance uses a generic renderer outside editable values", async () => {
  const source = await readFile(new URL("../src/scripts/metadata-guidance.js", import.meta.url), "utf8");
  assert.match(source, /GUIDANCE_RULES/);
  assert.match(source, /insertAdjacentElement\("afterend", hint\)/);
  assert.match(source, /currentLocaleText\(rule\.messageKey\)/);
  assert.doesNotMatch(source, /textarea\.value|buildLang|download\(/);
});

test("hosted and standalone builds include metadata guidance", async () => {
  const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
  const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");
  assert.match(html, /scripts\/metadata-guidance\.js/);
  assert.match(build, /bundledMetadataGuidance/);
  assert.match(build, /metadataGuidanceTag/);
});

test("reviewed locales provide all metadata guidance messages", async () => {
  const keys = ["metadata.localname", "metadata.engname", "metadata.extrasymbols", "metadata.langCredits"];
  for (const code of ["en", "bg", "ru"]) {
    const data = JSON.parse(await readFile(new URL(`../src/scripts/i18n/locales/${code}.json`, import.meta.url), "utf8"));
    for (const key of keys) assert.equal(typeof data.messages[key], "string", `${code}: ${key}`);
  }
});
`;
await writeFile(testPath, testSource, "utf8");

await writeFile(workflowPath, `name: Validate project

on:
  push:
    branches:
      - main
      - "agent/**"
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Verify project and standalone build
        run: npm run verify
`, "utf8");

await unlink(new URL(import.meta.url));
console.log("Metadata guidance integration applied.");
