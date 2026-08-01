"use strict";

/*
 * Built-in interface locales.
 *
 * English, Bulgarian and Russian are human-maintained.
 * All other translations were generated with AI and should be treated as
 * provisional until reviewed and corrected by native speakers.
 *
 * Missing message keys intentionally fall back to English.
 * Locale content is stored in ./locales/*.json. The generated runtime bundle
 * is rebuilt from those JSON files and must not be edited manually.
 */
const I18N = Object.create(null);
globalThis.I18N = I18N;

(function initializeLocaleRegistry() {
  const locales = new Map();

  function addOption(locale) {
    const select = document.getElementById("uiLang");
    if (!select || [...select.options].some(option => option.value === locale.code)) return;
    const option = document.createElement("option");
    option.value = locale.code;
    option.textContent = locale.nativeName || locale.name || locale.code;
    select.append(option);
  }

  function register(locale) {
    if (!locale || typeof locale.code !== "string" || !locale.messages || typeof locale.messages !== "object") {
      throw new TypeError("A valid built-in interface locale is required.");
    }
    const code = locale.code;
    if (locales.has(code)) throw new TypeError("Duplicate built-in locale: " + code);
    if (code !== "en" && !I18N.en) throw new Error("The English locale must be registered first.");

    I18N[code] = Object.freeze(code === "en"
      ? { ...locale.messages }
      : { ...I18N.en, ...locale.messages });

    const metadata = Object.freeze({
      code,
      name: locale.name || code,
      nativeName: locale.nativeName || locale.name || code,
      reviewed: Boolean(locale.reviewed),
      messageCount: Object.keys(locale.messages).length
    });
    locales.set(code, metadata);
    addOption(metadata);
  }

  globalThis.NecesseLocales = Object.freeze({
    register,
    getAll: () => [...locales.values()],
    get: code => locales.get(code) || null,
    isBuiltIn: code => locales.has(code)
  });
})();
