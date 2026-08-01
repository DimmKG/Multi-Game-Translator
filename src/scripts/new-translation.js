export function createTranslationFromReference(text, referenceFilename = "") {
  const source = String(text ?? "");
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  let entryCount = 0;
  const output = source.split(/\r\n|\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || /^\[.*\]$/.test(trimmed)) return line;
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
      const loader = globalThis.NecesseLangTranslator?.loadWorkspaceFromText;
      if (typeof loader !== "function") {
        showToast(localeText("err.generic"));
        input.value = "";
        return;
      }
      loader(result.text, {
        filename: "",
        referenceFilename: result.referenceFilename,
        targetLang: ""
      });
      showToast(localeText("toast.newTranslationCreated").replace("{file}", result.referenceFilename).replace("{n}", String(result.entryCount)));
      input.value = "";
    };
    reader.onerror = () => showToast(localeText("err.readFile").replace("{msg}", reader.error?.message || localeText("err.generic")));
    reader.readAsText(file, "UTF-8");
  });

  $("uiLang")?.addEventListener("change", () => setTimeout(localize, 0));
  localize();
}

globalThis.NecesseNewTranslation = Object.freeze({ createTranslationFromReference });
if (typeof document !== "undefined") setupNewTranslationUi();
