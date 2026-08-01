import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  return text.replace(from, to);
}

const htmlPath = "src/index.html";
let html = await readFile(htmlPath, "utf8");
html = replaceOnce(
  html,
  '    <button class="btn ghost" id="btnNew" data-i18n="btn.newFile"></button>',
  '    <button class="btn ghost" id="btnNew" data-i18n-title="btn.openAnotherTitle" data-i18n="btn.openAnother"></button>\n    <button class="btn ghost" id="btnNewTranslation" data-i18n-title="btn.newTranslationTitle" data-i18n="btn.newTranslation"></button>',
  "top action buttons"
);
html = replaceOnce(
  html,
  '  <input type="file" id="fileInput" accept=".lang,.txt" hidden>',
  '  <input type="file" id="fileInput" accept=".lang,.txt" hidden>\n  <input type="file" id="newTranslationInput" accept=".lang,.txt" hidden>',
  "new translation file input"
);
await writeFile(htmlPath, html, "utf8");

const appPath = "src/scripts/app.js";
let app = await readFile(appPath, "utf8");

const insertionAnchor = '  function loadText(text, filename){';
if (!app.includes(insertionAnchor)) throw new Error("Missing loadText anchor");
const reusableFunction = `  function createTranslationFromReference(text, referenceFilename){
    const parsed = parse(text);
    const entries = parsed.items.filter(item => item.type === "entry");
    if (!entries.length) return false;

    // Reuse the normal workspace initialization, then deliberately replace the
    // target-specific state. The selected file is the source/reference, not the
    // filename or language of the new translation.
    loadText(text, referenceFilename);
    for (const item of state.items){
      if (item.type !== "entry") continue;
      item.wasMissing = true;
      item.markedSame = false;
      item.touched = false;
      item.ref = item.english;
      item.value = item.english;
    }

    state.filename = "";
    state.referenceFilename = referenceFilename || "";
    state.targetLang = "";
    state.filter = "missing";
    state.query = "";
    state.reviewFilter = "all";
    state.reviewQuery = "";
    state.diffOther = null;
    state.view = "editor";

    $("outName").value = "";
    $("search").value = "";
    $("reviewSearch").value = "";
    $("mtTarget").value = "";
    $("diffName").textContent = "";
    $("diffStat").textContent = "";
    $("difflist").innerHTML = "";
    document.querySelectorAll(".filt").forEach(x => x.classList.toggle("on", x.dataset.f === "missing"));
    document.querySelectorAll(".rchip").forEach(x => x.classList.toggle("on", x.dataset.r === "all"));

    indexItems();
    buildDict();
    updateReferenceBtn();
    refreshMeter();
    renderSectionJumps();
    setView("editor");
    saveLS();
    return true;
  }

  globalThis.NecesseLangTranslator = globalThis.NecesseLangTranslator || {};
  globalThis.NecesseLangTranslator.createTranslationFromReference = createTranslationFromReference;

`;
app = app.replace(insertionAnchor, reusableFunction + insertionAnchor);

app = replaceOnce(
  app,
  '  $("btnNew").onclick = () => $("fileInput").click();\n  $("btnExport").onclick = () => {\n    let name = ($("outName").value || "").trim() || state.filename || "ru.lang";',
  '  $("btnNew").onclick = () => $("fileInput").click();\n  $("btnNewTranslation").onclick = () => $("newTranslationInput").click();\n  $("newTranslationInput").onchange = e => {\n    const f = e.target.files && e.target.files[0];\n    if (!f) return;\n    const r = new FileReader();\n    r.onload = () => {\n      if (createTranslationFromReference(String(r.result || ""), f.name)) {\n        toast(t("toast.newTranslationCreated"));\n        $("outName").focus();\n      } else {\n        toast(t("toast.invalidReference"));\n      }\n    };\n    r.readAsText(f, "UTF-8");\n    e.target.value = "";\n  };\n  $("btnExport").onclick = () => {\n    let name = ($("outName").value || "").trim() || state.filename;\n    if (!name){\n      toast(t("toast.targetFilenameRequired"));\n      $("outName").focus();\n      return;\n    }',
  "new translation and safe export handlers"
);
await writeFile(appPath, app, "utf8");

const localizedMessages = {
  en: {
    "btn.openAnother": "Open another file",
    "btn.openAnotherTitle": "Open another existing translation file",
    "btn.newTranslation": "New translation",
    "btn.newTranslationTitle": "Create a new translation from a selected reference .lang file",
    "toast.newTranslationCreated": "New translation workspace created. Enter the target filename before exporting.",
    "toast.invalidReference": "The selected file does not contain any translation entries.",
    "toast.targetFilenameRequired": "Enter the target .lang filename before exporting."
  },
  bg: {
    "btn.openAnother": "Отвори друг файл",
    "btn.openAnotherTitle": "Отваря друг съществуващ файл с превод",
    "btn.newTranslation": "Нов превод",
    "btn.newTranslationTitle": "Създава нов превод от избран референтен .lang файл",
    "toast.newTranslationCreated": "Създаден е нов работен превод. Въведете името на целевия файл преди експортиране.",
    "toast.invalidReference": "Избраният файл не съдържа записи за превод.",
    "toast.targetFilenameRequired": "Въведете името на целевия .lang файл преди експортиране."
  },
  ru: {
    "btn.openAnother": "Открыть другой файл",
    "btn.openAnotherTitle": "Открывает другой существующий файл перевода",
    "btn.newTranslation": "Новый перевод",
    "btn.newTranslationTitle": "Создаёт новый перевод из выбранного референтного файла .lang",
    "toast.newTranslationCreated": "Создано новое рабочее пространство перевода. Перед экспортом укажите имя целевого файла.",
    "toast.invalidReference": "Выбранный файл не содержит записей для перевода.",
    "toast.targetFilenameRequired": "Перед экспортом укажите имя целевого файла .lang."
  }
};

for (const [code, messages] of Object.entries(localizedMessages)) {
  const path = `src/scripts/i18n/locales/${code}.json`;
  const locale = JSON.parse(await readFile(path, "utf8"));
  Object.assign(locale.messages, messages);
  await writeFile(path, JSON.stringify(locale, null, 2) + "\n", "utf8");
}

const test = `import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const locales = Object.fromEntries(await Promise.all(["en", "bg", "ru"].map(async code => [
  code,
  JSON.parse(await readFile(new URL(\`../src/scripts/i18n/locales/\${code}.json\`, import.meta.url), "utf8"))
])));

test("new translation action is distinct from opening an existing file", () => {
  assert.match(html, /id="btnNew"[^>]*data-i18n="btn.openAnother"/);
  assert.match(html, /id="btnNewTranslation"[^>]*data-i18n-title="btn.newTranslationTitle"/);
  assert.match(html, /id="newTranslationInput"/);
  assert.match(app, /btnNewTranslation.*newTranslationInput/);
});

test("reference conversion preserves source values while marking every entry missing", () => {
  assert.match(app, /function createTranslationFromReference/);
  assert.match(app, /item\.wasMissing = true/);
  assert.match(app, /item\.ref = item\.english/);
  assert.match(app, /item\.value = item\.english/);
  assert.match(app, /state\.referenceFilename = referenceFilename/);
  assert.match(app, /state\.targetLang = ""/);
  assert.match(app, /NecesseLangTranslator\.createTranslationFromReference/);
});

test("new translation export requires an explicit target filename", () => {
  assert.doesNotMatch(app, /state\.filename \|\| "ru\.lang"/);
  assert.match(app, /toast\(t\("toast\.targetFilenameRequired"\)\)/);
  assert.match(app, /if \(!name\)/);
});

test("English Bulgarian and Russian fully cover the new interface messages", () => {
  const keys = [
    "btn.openAnother", "btn.openAnotherTitle", "btn.newTranslation",
    "btn.newTranslationTitle", "toast.newTranslationCreated",
    "toast.invalidReference", "toast.targetFilenameRequired"
  ];
  for (const [code, locale] of Object.entries(locales)) {
    for (const key of keys) assert.equal(typeof locale.messages[key], "string", \`\${code}: \${key}\`);
  }
});
`;
await writeFile("test/new-translation-from-reference.test.mjs", test, "utf8");
console.log("Applied new translation from reference workflow.");
