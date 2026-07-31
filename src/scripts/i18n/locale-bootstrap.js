"use strict";

(function restoreInstalledInterfaceLocales() {
  const storageKey = "necesse-translator.interface-locales.v1";
  try {
    const packages = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(packages)) return;
    const select = document.getElementById("uiLang");
    for (const locale of packages) {
      if (!locale || typeof locale.code !== "string" || !locale.messages || typeof locale.messages !== "object") continue;
      if (["en", "bg", "ru"].includes(locale.code)) continue;
      I18N[locale.code] = Object.freeze({ ...I18N.en, ...locale.messages });
      if (select && ![...select.options].some(option => option.value === locale.code)) {
        const option = document.createElement("option");
        option.value = locale.code;
        option.textContent = locale.nativeName || locale.name || locale.code;
        select.append(option);
      }
    }
  } catch { /* Ignore invalid or unavailable saved locale data. */ }
})();
