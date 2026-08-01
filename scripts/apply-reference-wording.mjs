import { readFile, writeFile } from "node:fs/promises";

const localeUpdates = {
  en: {
    "btn.enRef": "Reference file",
    "btn.enRefTitle": "Load a compatible .lang reference file (for example, en.lang). The current Google provider expects English source text.",
    "btn.enRefLoaded": "{file} ✓ {n}",
    "btn.enRefLoadedTitle": "Reference file {file}: {n} strings matched. Click to replace it.",
    "filter.same": "Same as reference",
    "card.referenceText": "Reference text",
    "badge.same": "same as reference",
    "mt.langLabel": "target language",
    "mt.btnTitle": "Draft machine translation of the source text shown on this card (tokens are preserved). Always review it.",
    "mt.needReference": "Load a reference file first (for example, en.lang). The current Google provider expects English source text.",
    "mt.emptySrc": "Nothing to translate — source text is empty",
    "same.on": "✓ same as reference",
    "same.off": "same as reference",
    "same.title": "Mark that the translation intentionally matches the reference text (SAME_TRANSLATION)",
    "rflag.sameRef": "= reference",
    "review.referenceLabel": "reference",
    "review.noRef": "— load a reference file (for example, en.lang)",
    "footnote.same": " · same as reference: {n}",
    "toast.referenceMatched": "{file}: {n} strings matched",
    "settings.referenceReminder": "Highlight missing reference file",
    "settings.referenceReminderHint": "Pulse the reference-file button after a translation file is opened until a compatible reference is loaded. For the current Google provider, use an English reference such as en.lang.",
    "settings.tab.general": "General",
    "settings.tab.fonts": "Fonts",
    "settings.tab.machine-translation": "Machine Translation",
    "settings.tab.secrets": "Secrets",
    "settings.tabsLabel": "Settings sections"
  },
  bg: {
    "btn.enRef": "Референтен файл",
    "btn.enRefTitle": "Заредете съвместим .lang референтен файл (например en.lang). Текущият доставчик Google очаква изходен текст на английски.",
    "btn.enRefLoaded": "{file} ✓ {n}",
    "btn.enRefLoadedTitle": "Референтен файл {file}: съвпадат {n} низа. Кликнете, за да го замените.",
    "filter.same": "Като референцията",
    "card.referenceText": "Референтен текст",
    "badge.same": "като референцията",
    "mt.langLabel": "целеви език",
    "mt.btnTitle": "Чернова от машинен превод на изходния текст в картата (токените се запазват). Винаги проверявайте резултата.",
    "mt.needReference": "Първо заредете референтен файл (например en.lang). Текущият доставчик Google очаква изходен текст на английски.",
    "mt.emptySrc": "Няма нищо за превод — изходният текст е празен",
    "same.on": "✓ като референцията",
    "same.off": "като референцията",
    "same.title": "Отбележете, че преводът умишлено съвпада с референтния текст (SAME_TRANSLATION)",
    "rflag.sameRef": "= референцията",
    "review.referenceLabel": "референция",
    "review.noRef": "— заредете референтен файл (например en.lang)",
    "footnote.same": " · като референцията: {n}",
    "toast.referenceMatched": "{file}: съвпадат {n} низа",
    "settings.referenceReminder": "Подчертавай липсващия референтен файл",
    "settings.referenceReminderHint": "Бутонът за референтен файл ще пулсира след зареждане на превод, докато не бъде добавена съвместима референция. За текущия доставчик Google използвайте английска референция като en.lang.",
    "settings.tab.general": "Общи",
    "settings.tab.fonts": "Шрифтове",
    "settings.tab.machine-translation": "Машинен превод",
    "settings.tab.secrets": "Тайни данни",
    "settings.tabsLabel": "Раздели на настройките"
  },
  ru: {
    "btn.enRef": "Файл-источник",
    "btn.enRefTitle": "Загрузите совместимый справочный файл .lang (например, en.lang). Текущий поставщик Google ожидает исходный текст на английском языке.",
    "btn.enRefLoaded": "{file} ✓ {n}",
    "btn.enRefLoadedTitle": "Справочный файл {file}: совпало строк — {n}. Нажмите, чтобы заменить его.",
    "filter.same": "Как в источнике",
    "card.referenceText": "Текст источника",
    "badge.same": "как в источнике",
    "mt.langLabel": "целевой язык",
    "mt.btnTitle": "Черновой машинный перевод исходного текста на карточке (токены сохраняются). Всегда проверяйте результат.",
    "mt.needReference": "Сначала загрузите справочный файл (например, en.lang). Текущий поставщик Google ожидает исходный текст на английском языке.",
    "mt.emptySrc": "Нечего переводить — исходный текст пуст",
    "same.on": "✓ как в источнике",
    "same.off": "как в источнике",
    "same.title": "Отметить, что перевод намеренно совпадает с текстом источника (SAME_TRANSLATION)",
    "rflag.sameRef": "= источнику",
    "review.referenceLabel": "источник",
    "review.noRef": "— загрузите справочный файл (например, en.lang)",
    "footnote.same": " · как в источнике: {n}",
    "toast.referenceMatched": "{file}: совпало строк — {n}",
    "settings.referenceReminder": "Подсвечивать отсутствие файла-источника",
    "settings.referenceReminderHint": "Кнопка справочного файла будет пульсировать после загрузки перевода, пока не будет добавлен совместимый источник. Для текущего поставщика Google используйте английский источник, например en.lang.",
    "settings.tab.general": "Общие",
    "settings.tab.fonts": "Шрифты",
    "settings.tab.machine-translation": "Машинный перевод",
    "settings.tab.secrets": "Секреты",
    "settings.tabsLabel": "Разделы настроек"
  }
};

const removedKeys = [
  "card.enOriginal",
  "mt.needEnRef",
  "rflag.sameEng",
  "review.enLabel",
  "toast.enMatched"
];

for (const [code, updates] of Object.entries(localeUpdates)) {
  const path = `src/scripts/i18n/locales/${code}.json`;
  const locale = JSON.parse(await readFile(path, "utf8"));
  Object.assign(locale.messages, updates);
  for (const key of removedKeys) delete locale.messages[key];
  await writeFile(path, JSON.stringify(locale, null, 2) + "\n", "utf8");
}

const appPath = "src/scripts/app.js";
let app = await readFile(appPath, "utf8");
const replacements = [
  ["updateEnBtn", "updateReferenceBtn"],
  ["parseEnLang", "parseReferenceLang"],
  ["applyEnRef", "applyReference"],
  ["enFilename", "referenceFilename"],
  ["sourceEN", "referenceSource"],
  ["baseEN", "sourceText"],
  ['t("card.enOriginal")', 't("card.referenceText")'],
  ['t("mt.needEnRef")', 't("mt.needReference")'],
  ['t("rflag.sameEng")', 't("rflag.sameRef")'],
  ['t("review.enLabel")', 't("review.referenceLabel")'],
  ['t("toast.enMatched", {n})', 't("toast.referenceMatched", {file: f.name, n})'],
  ['t("btn.enRefLoaded", {n})', 't("btn.enRefLoaded", {file: state.referenceFilename, n})'],
  ["// English source for an entry: en.lang reference if loaded, else the English\n  // that shipped inline for MISSING entries. null when no English is available.", "// Source text for an entry: the loaded reference value when available, otherwise\n  // the inline value carried by a MISSING_TRANSLATION entry. null when unavailable."],
  ["const english = body.slice(eq+1);       // original value (English for missing)", "const english = body.slice(eq+1);       // inline source value for missing entries"],
  ["// working value: for missing -> prefill with english so tokens are preserved; else the existing value", "// working value: prefill missing entries with their inline source so tokens are preserved"],
];
for (const [from, to] of replacements) {
  if (!app.includes(from) && !from.startsWith("updateEnBtn") && !from.startsWith("parseEnLang") && !from.startsWith("applyEnRef") && !from.startsWith("enFilename") && !from.startsWith("sourceEN") && !from.startsWith("baseEN")) {
    throw new Error(`Expected app text not found: ${from}`);
  }
  app = app.split(from).join(to);
}
await writeFile(appPath, app, "utf8");

const tabsPath = "src/scripts/settings-tabs.js";
let tabs = await readFile(tabsPath, "utf8");
tabs = tabs.replace(
  'ui.tablist.setAttribute("aria-label", "Settings sections");',
  'ui.tablist.setAttribute("aria-label", globalThis.NecesseI18n?.t("settings.tabsLabel") || "Settings sections");'
);
await writeFile(tabsPath, tabs, "utf8");

const testPath = "test/reference-wording.test.mjs";
await writeFile(testPath, `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");\nconst tabs = await readFile(new URL("../src/scripts/settings-tabs.js", import.meta.url), "utf8");\nconst locales = await Promise.all(["en", "bg", "ru"].map(async code => JSON.parse(await readFile(new URL(\`../src/scripts/i18n/locales/\${code}.json\`, import.meta.url), "utf8"))));\n\ntest("reference-file UI shows the actual loaded filename", () => {\n  assert.match(app, /btn\\.enRefLoaded\\", \\{file: state\\.referenceFilename, n\\}/);\n  assert.match(app, /toast\\.referenceMatched\\", \\{file: f\\.name, n\\}/);\n});\n\ntest("human-maintained locales describe a general reference file", () => {\n  for (const locale of locales) {\n    assert.ok(locale.messages["btn.enRef"]);\n    assert.match(locale.messages["btn.enRefTitle"], /\\.lang/i);\n    assert.ok(locale.messages["card.referenceText"]);\n    assert.ok(locale.messages["mt.needReference"]);\n    assert.equal(locale.messages["card.enOriginal"], undefined);\n    assert.equal(locale.messages["mt.needEnRef"], undefined);\n  }\n});\n\ntest("Google's current English-source limitation remains explicit", () => {\n  assert.match(locales[0].messages["btn.enRefTitle"], /Google provider expects English source text/);\n  assert.match(locales[0].messages["settings.referenceReminderHint"], /English reference/);\n});\n\ntest("Settings tab labels come from locale messages", () => {\n  assert.match(tabs, /settings\\.tabsLabel/);\n  for (const locale of locales) {\n    for (const id of ["general", "fonts", "machine-translation", "secrets"]) {\n      assert.ok(locale.messages[\`settings.tab.\${id}\`]);\n    }\n  }\n});\n`, "utf8");

console.log("Applied reference-file wording and focused locale pass.");
