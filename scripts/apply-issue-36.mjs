import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const read = path => readFile(resolve(root, path), "utf8");
const write = (path, content) => writeFile(resolve(root, path), content, "utf8");

const browserScript = `export function createTranslationFromReference(text, referenceFilename = "") {
  const source = String(text ?? "");
  const eol = source.includes("\\r\\n") ? "\\r\\n" : "\\n";
  let entryCount = 0;
  const output = source.split(/\\r\\n|\\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || /^\\[.*\\]$/.test(trimmed)) return line;
    let body = line;
    if (body.startsWith("MISSING_TRANSLATION:")) body = body.slice("MISSING_TRANSLATION:".length);
    else if (body.startsWith("SAME_TRANSLATION:")) body = body.slice("SAME_TRANSLATION:".length);
    if (body.indexOf("=") < 0) return line;
    entryCount++;
    return "MISSING_TRANSLATION:" + body;
  }).join(eol);
  return { text: output, referenceFilename: String(referenceFilename || ""), entryCount };
}

function setupNewTranslationUi() {
  const $ = id => document.getElementById(id);
  const localeText = key => {
    const code = $("uiLang")?.value || "en";
    return globalThis.I18N?.[code]?.[key] ?? globalThis.I18N?.en?.[key] ?? key;
  };
  const showToast = message => {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  };
  const localize = () => {
    const open = $("btnNew");
    if (open) {
      open.textContent = localeText("btn.newFile");
      open.title = localeText("btn.newFileTitle");
    }
    for (const button of document.querySelectorAll("[data-new-translation-button]")) {
      button.textContent = localeText("btn.newTranslation");
      button.title = localeText("btn.newTranslationTitle");
    }
  };

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".lang,.txt";
  input.hidden = true;
  input.id = "newTranslationInput";
  document.body.appendChild(input);

  const makeButton = className => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.newTranslationButton = "";
    button.addEventListener("click", () => input.click());
    return button;
  };

  const topOpen = $("btnNew");
  if (topOpen?.parentElement) topOpen.parentElement.insertBefore(makeButton("btn ghost"), topOpen);
  const pick = $("btnPick");
  if (pick?.parentElement) pick.insertAdjacentElement("afterend", makeButton("btn ghost"));

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = createTranslationFromReference(reader.result, file.name);
      if (!result.entryCount) {
        showToast(localeText("err.newTranslationNoEntries"));
        input.value = "";
        return;
      }
      const generated = new File([result.text], "translation.lang", { type: "text/plain;charset=utf-8" });
      const existingInput = $("fileInput");
      if (typeof existingInput?.onchange !== "function") return;
      existingInput.onchange({ target: { files: [generated], value: "" } });
      setTimeout(() => {
        const outputName = $("outName");
        if (outputName) outputName.value = "";
        const target = $("mtTarget");
        if (target) {
          target.value = "";
          target.dispatchEvent(new Event("input", { bubbles: true }));
          target.dispatchEvent(new Event("change", { bubbles: true }));
        }
        showToast(localeText("toast.newTranslationCreated").replace("{file}", result.referenceFilename).replace("{n}", String(result.entryCount)));
      }, 120);
      input.value = "";
    };
    reader.onerror = () => showToast(localeText("err.readFile").replace("{msg}", reader.error?.message || localeText("err.generic")));
    reader.readAsText(file, "UTF-8");
  });

  $("btnExport")?.addEventListener("click", event => {
    const outputName = $("outName");
    if (outputName?.value.trim()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showToast(localeText("err.targetFilenameRequired"));
    outputName?.focus();
  }, true);

  $("uiLang")?.addEventListener("change", () => setTimeout(localize, 0));
  localize();
}

globalThis.NecesseNewTranslation = Object.freeze({ createTranslationFromReference });
if (typeof document !== "undefined") setupNewTranslationUi();
`;
await write("src/scripts/new-translation.js", browserScript);

let index = await read("src/index.html");
index = index.replace(
  '<script src="./scripts/app.js"></script>\n',
  '<script src="./scripts/app.js"></script>\n<script type="module" src="./scripts/new-translation.js"></script>\n'
);
await write("src/index.html", index);

let build = await read("scripts/build-standalone.mjs");
build = build.replace(
  "providers, app, settings, fontSettings",
  "providers, app, newTranslation, settings, fontSettings"
);
build = build.replace(
  '  readFile(resolve(source, "scripts/app.js"), "utf8"),\n  readFile(resolve(source, "scripts/settings.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/app.js"), "utf8"),\n  readFile(resolve(source, "scripts/new-translation.js"), "utf8"),\n  readFile(resolve(source, "scripts/settings.js"), "utf8"),'
);
build = build.replace(
  '.replace(\'<script src="./scripts/app.js"></script>\', `<script>${combinedApp}</script>`)\n',
  '.replace(\'<script src="./scripts/app.js"></script>\', `<script>${combinedApp}</script>`)\n  .replace(\'<script type="module" src="./scripts/new-translation.js"></script>\', `<script type="module">${newTranslation}</script>`)\n'
);
await write("scripts/build-standalone.mjs", build);

const translations = {
  en: {
    "btn.newFile": "Open another file",
    "btn.newFileTitle": "Open another existing translation file",
    "btn.newTranslation": "New translation",
    "btn.newTranslationTitle": "Create a new translation from a selected reference .lang file",
    "toast.newTranslationCreated": "New translation created from {file} · {n} strings",
    "err.newTranslationNoEntries": "The selected reference file contains no translation entries",
    "err.targetFilenameRequired": "Enter the target .lang filename before downloading"
  },
  bg: {
    "btn.newFile": "Отвори друг файл",
    "btn.newFileTitle": "Отваря друг съществуващ файл с превод",
    "btn.newTranslation": "Нов превод",
    "btn.newTranslationTitle": "Създава нов превод от избран референтен .lang файл",
    "toast.newTranslationCreated": "Създаден е нов превод от {file} · {n} низа",
    "err.newTranslationNoEntries": "Избраният референтен файл не съдържа низове за превод",
    "err.targetFilenameRequired": "Въведете името на целевия .lang файл преди изтегляне"
  },
  ru: {
    "btn.newFile": "Открыть другой файл",
    "btn.newFileTitle": "Открыть другой существующий файл перевода",
    "btn.newTranslation": "Новый перевод",
    "btn.newTranslationTitle": "Создать новый перевод из выбранного референсного файла .lang",
    "toast.newTranslationCreated": "Новый перевод создан из {file} · строк: {n}",
    "err.newTranslationNoEntries": "Выбранный референсный файл не содержит строк для перевода",
    "err.targetFilenameRequired": "Введите имя целевого файла .lang перед скачиванием"
  }
};
for (const [code, messages] of Object.entries(translations)) {
  const path = `src/scripts/i18n/locales/${code}.json`;
  const locale = JSON.parse(await read(path));
  Object.assign(locale.messages, messages);
  await write(path, JSON.stringify(locale, null, 2) + "\n");
}

const test = `import test from "node:test";
import assert from "node:assert/strict";
import { createTranslationFromReference } from "../src/scripts/new-translation.js";

const source = [
  "// header",
  "[general]",
  "hello=Hello <name>",
  "SAME_TRANSLATION:unchanged=Keep [item/input=stone]",
  "MISSING_TRANSLATION:old=Old\\nline",
  "",
  "// footer"
].join("\\r\\n");

test("new translation preserves structure while marking every entry missing", () => {
  const result = createTranslationFromReference(source, "en.lang");
  assert.equal(result.referenceFilename, "en.lang");
  assert.equal(result.entryCount, 3);
  assert.equal(result.text, [
    "// header",
    "[general]",
    "MISSING_TRANSLATION:hello=Hello <name>",
    "MISSING_TRANSLATION:unchanged=Keep [item/input=stone]",
    "MISSING_TRANSLATION:old=Old\\nline",
    "",
    "// footer"
  ].join("\\r\\n"));
});

test("new translation reports an empty reference without inventing entries", () => {
  const result = createTranslationFromReference("// comments only\\n[section]", "empty.lang");
  assert.equal(result.entryCount, 0);
  assert.equal(result.text, "// comments only\\n[section]");
});

test("new translation UI requires an explicit target filename", async () => {
  const app = await readFile(new URL("../src/scripts/new-translation.js", import.meta.url), "utf8");
  assert.match(app, /err\\.targetFilenameRequired/);
  assert.match(app, /outputName\\?\\.value\\.trim\\(\\)/);
  assert.doesNotMatch(app, /ru\\.lang/);
});

import { readFile } from "node:fs/promises";
`;
await write("test/new-translation-from-reference.test.mjs", test);

console.log("Applied Issue #36 implementation.");
