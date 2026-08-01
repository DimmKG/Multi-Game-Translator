"use strict";

(function initializeMtTargetLanguage() {
  const LANGUAGE_OPTIONS = Object.freeze([
    ["ar", "العربية"], ["bg", "Български"], ["ca", "Català"], ["cs", "Čeština"],
    ["da", "Dansk"], ["de", "Deutsch"], ["en", "English"], ["es", "Español"],
    ["fi", "Suomi"], ["fr", "Français"], ["hr", "Hrvatski"], ["hu", "Magyar"],
    ["id", "Bahasa Indonesia"], ["it", "Italiano"], ["ja", "日本語"], ["ko", "한국어"],
    ["lt", "Lietuvių"], ["nl", "Nederlands"], ["no", "Norsk"], ["pl", "Polski"],
    ["pt-BR", "Português (Brasil)"], ["pt-PT", "Português (Portugal)"], ["ru", "Русский"],
    ["se", "Svenska"], ["th", "ไทย"], ["tr", "Türkçe"], ["uk", "Українська"],
    ["vi", "Tiếng Việt"], ["zh-CN", "中文（简体）"], ["zh-TW", "中文（繁體）"]
  ]);

  const RECOGNIZED = new Map(LANGUAGE_OPTIONS.map(([code]) => [code.toLowerCase(), code]));
  const LEGACY_ALIASES = new Map([
    ["pr", "pt-BR"], ["pr-br", "pt-BR"], ["pt", "pt-BR"],
    ["zh-hk", "zh-TW"], ["nb-no", "no"], ["nn-no", "no"]
  ]);

  function t(key) {
    return globalThis.NecesseI18n?.t(key) || key;
  }

  function normalizeProjectCode(value) {
    const raw = String(value || "").trim().replace(/_/g, "-");
    if (!raw) return "";
    const lower = raw.toLowerCase();
    return LEGACY_ALIASES.get(lower) || RECOGNIZED.get(lower) || "";
  }

  function codeFromFilename(filename) {
    const name = String(filename || "").trim().replace(/^.*[\\/]/, "");
    if (!/\.lang$/i.test(name)) return "";
    const base = name.replace(/\.lang$/i, "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .replace(/_\d+_?$/g, "");
    return normalizeProjectCode(base);
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `#mtTarget[hidden]{display:none!important}#mtTargetSelect{width:auto;min-width:180px;max-width:240px}.mtbtn[data-mt-target-missing="true"]{opacity:.45;cursor:not-allowed}`;
    document.head.append(style);
  }

  function buildSelector(input) {
    const select = document.createElement("select");
    select.id = "mtTargetSelect";
    select.className = input.className;
    select.title = input.title || t("mt.langTitle");
    select.setAttribute("aria-label", select.title);

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "—";
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
    return select;
  }

  function syncInput(input, select, code) {
    input.value = code;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    select.value = code;
  }

  function applyAvailability(select) {
    const disabled = !select.value;
    for (const button of document.querySelectorAll(".mtbtn")) {
      button.disabled = disabled || button.classList.contains("loading");
      button.dataset.mtTargetMissing = disabled ? "true" : "false";
    }
  }

  function filename() {
    return document.getElementById("outName")?.value || "";
  }

  function syncFromWorkspace(input, select) {
    const current = normalizeProjectCode(input.value);
    const inferred = codeFromFilename(filename());
    const chosen = current || inferred;

    select.value = chosen;
    if (chosen && input.value !== chosen) syncInput(input, select, chosen);
    if (!chosen) input.value = "";
    applyAvailability(select);
  }

  function initialize() {
    const input = document.getElementById("mtTarget");
    if (!input || document.getElementById("mtTargetSelect")) return;

    injectStyles();
    const select = buildSelector(input);

    select.addEventListener("change", () => {
      syncInput(input, select, select.value);
      applyAvailability(select);
    });

    const workspaceObserver = new MutationObserver(() => syncFromWorkspace(input, select));
    const actions = document.getElementById("topActions");
    const list = document.getElementById("list");
    if (actions) workspaceObserver.observe(actions, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    if (list) workspaceObserver.observe(list, { childList: true });

    document.getElementById("outName")?.addEventListener("change", () => syncFromWorkspace(input, select));
    document.getElementById("outName")?.addEventListener("blur", () => syncFromWorkspace(input, select));
    document.getElementById("uiLang")?.addEventListener("change", () => {
      select.title = t("mt.langTitle");
      select.setAttribute("aria-label", select.title);
    });

    document.addEventListener("click", event => {
      const button = event.target.closest?.(".mtbtn");
      if (!button || select.value) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      select.focus();
    }, true);

    syncFromWorkspace(input, select);

    globalThis.NecesseMtTarget = Object.freeze({
      languages: LANGUAGE_OPTIONS.map(([code, name]) => ({ code, name })),
      normalizeProjectCode,
      codeFromFilename,
      get: () => select.value,
      set(code) {
        const normalized = normalizeProjectCode(code);
        syncInput(input, select, normalized);
        applyAvailability(select);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
