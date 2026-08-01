"use strict";

(function initializeMtTargetLanguage() {
  const LANGUAGE_OPTIONS = Object.freeze([
    ["ar", "العربية"],
    ["bg", "Български"],
    ["ca", "Català"],
    ["cs", "Čeština"],
    ["da", "Dansk"],
    ["de", "Deutsch"],
    ["en", "English"],
    ["es", "Español"],
    ["fi", "Suomi"],
    ["fr", "Français"],
    ["hr", "Hrvatski"],
    ["hu", "Magyar"],
    ["id", "Bahasa Indonesia"],
    ["it", "Italiano"],
    ["ja", "日本語"],
    ["ko", "한국어"],
    ["lt", "Lietuvių"],
    ["nl", "Nederlands"],
    ["no", "Norsk"],
    ["pl", "Polski"],
    ["pt-BR", "Português (Brasil)"],
    ["pt-PT", "Português (Portugal)"],
    ["ru", "Русский"],
    ["se", "Svenska"],
    ["th", "ไทย"],
    ["tr", "Türkçe"],
    ["uk", "Українська"],
    ["vi", "Tiếng Việt"],
    ["zh-CN", "中文（简体）"],
    ["zh-TW", "中文（繁體）"]
  ]);

  const RECOGNIZED = new Map(LANGUAGE_OPTIONS.map(([code]) => [code.toLowerCase(), code]));
  const LEGACY_ALIASES = new Map([
    ["pr", "pt-BR"],
    ["pr-br", "pt-BR"],
    ["pt", "pt-BR"],
    ["zh-hk", "zh-TW"],
    ["nb-no", "no"],
    ["nn-no", "no"]
  ]);

  const text = {
    select: "Select target language…",
    unknown: "The target language could not be determined from the filename. Select one before using machine translation.",
    suggested: filename => `Suggested from ${filename}. Check the selection before translating.`,
    manual: "Used only for machine translation. You can change it at any time."
  };

  function normalizeProjectCode(value) {
    const raw = String(value || "").trim().replace(/_/g, "-");
    if (!raw) return "";
    const lower = raw.toLowerCase();
    return LEGACY_ALIASES.get(lower) || RECOGNIZED.get(lower) || "";
  }

  function codeFromFilename(filename) {
    const name = String(filename || "").trim().replace(/^.*[\\/]/, "");
    if (!/\.lang$/i.test(name)) return "";
    return normalizeProjectCode(name.replace(/\.lang$/i, "").replace(/\s*\(\d+\)\s*$/, "").replace(/_\d+_?$/g, ""));
  }

  function buildSelector(input) {
    const select = document.createElement("select");
    select.id = "mtTargetSelect";
    select.className = input.className;
    select.setAttribute("aria-label", input.title || "Machine translation target language");

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = text.select;
    select.append(empty);

    for (const [code, label] of LANGUAGE_OPTIONS) {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${label} (${code})`;
      select.append(option);
    }

    input.hidden = true;
    input.tabIndex = -1;
    input.insertAdjacentElement("afterend", select);

    const hint = document.createElement("span");
    hint.id = "mtTargetHint";
    hint.className = "mthint mt-target-hint";
    select.insertAdjacentElement("afterend", hint);

    return { select, hint };
  }

  function syncInput(input, select, code) {
    input.value = code;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    select.value = code;
  }

  function machineTranslationButtons() {
    return [...document.querySelectorAll(".mtbtn")];
  }

  function applyAvailability(select) {
    const disabled = !select.value;
    for (const button of machineTranslationButtons()) {
      button.disabled = disabled || button.classList.contains("loading");
      button.dataset.mtTargetMissing = disabled ? "true" : "false";
    }
  }

  function filename() {
    return document.getElementById("outName")?.value || "";
  }

  function syncFromWorkspace(input, select, hint) {
    const current = normalizeProjectCode(input.value);
    const inferred = codeFromFilename(filename());
    const chosen = current || inferred;

    select.value = chosen;
    if (chosen && input.value !== chosen) syncInput(input, select, chosen);

    if (chosen) {
      hint.textContent = inferred === chosen ? text.suggested(filename()) : text.manual;
    } else {
      input.value = "";
      hint.textContent = text.unknown;
    }
    applyAvailability(select);
  }

  function initialize() {
    const input = document.getElementById("mtTarget");
    if (!input || document.getElementById("mtTargetSelect")) return;

    const { select, hint } = buildSelector(input);

    select.addEventListener("change", () => {
      syncInput(input, select, select.value);
      hint.textContent = select.value ? text.manual : text.unknown;
      applyAvailability(select);
    });

    const workspaceObserver = new MutationObserver(() => syncFromWorkspace(input, select, hint));
    const actions = document.getElementById("topActions");
    const list = document.getElementById("list");
    if (actions) workspaceObserver.observe(actions, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    if (list) workspaceObserver.observe(list, { childList: true });

    document.getElementById("outName")?.addEventListener("change", () => syncFromWorkspace(input, select, hint));
    document.getElementById("outName")?.addEventListener("blur", () => syncFromWorkspace(input, select, hint));

    document.addEventListener("click", event => {
      const button = event.target.closest?.(".mtbtn");
      if (!button || select.value) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      select.focus();
      hint.textContent = text.unknown;
    }, true);

    syncFromWorkspace(input, select, hint);

    globalThis.NecesseMtTarget = Object.freeze({
      languages: LANGUAGE_OPTIONS.map(([code, name]) => ({ code, name })),
      normalizeProjectCode,
      codeFromFilename,
      get: () => select.value,
      set(code) {
        const normalized = normalizeProjectCode(code);
        syncInput(input, select, normalized);
        hint.textContent = normalized ? text.manual : text.unknown;
        applyAvailability(select);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
