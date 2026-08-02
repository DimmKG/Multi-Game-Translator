"use strict";

(function initializeSharedInterfaceI18n() {
  const language = () => document.getElementById("uiLang")?.value || "en";
  const rtlLanguages = new Set(["ar"]);
  const applyDirection = (code = language()) => {
    document.documentElement.dir = rtlLanguages.has(String(code).toLowerCase()) ? "rtl" : "ltr";
  };
  const translate = (key, vars) => {
    const locale = I18N[language()] || I18N.en;
    let value = locale?.[key] != null ? locale[key] : (I18N.en?.[key] != null ? I18N.en[key] : key);
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = String(value).split("{" + name + "}").join(String(replacement));
      }
    }
    return String(value);
  };
  const plural = (base, count, vars = {}) => translate(base + "." + (count === 1 ? "one" : "other"), { ...vars, n: count });
  globalThis.NecesseI18n = Object.freeze({ t: translate, plural, applyDirection });

  document.addEventListener("change", event => {
    if (event.target?.id === "uiLang") applyDirection(event.target.value);
  });
  window.addEventListener("load", () => applyDirection());
})();

(function restoreInstalledInterfaceLocales() {
  const storageKey = "necesse-translator.interface-locales.v1";
  try {
    const packages = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(packages)) return;
    const select = document.getElementById("uiLang");
    for (const locale of packages) {
      if (!locale || typeof locale.code !== "string" || !locale.messages || typeof locale.messages !== "object") continue;
      if (globalThis.NecesseLocales?.isBuiltIn(locale.code)) continue;
      I18N[locale.code] = Object.freeze({ ...I18N.en, ...locale.messages });
      if (select && ![...select.options].some(option => option.value === locale.code)) {
        const option = document.createElement("option");
        option.value = locale.code;
        option.textContent = locale.nativeName || locale.name || locale.code;
        select.append(option);
      }
    }
  } catch {
    // Ignore invalid or unavailable saved locale data.
  }
})();
