"use strict";

(function initializeMtProviders() {
  class MtProviderError extends Error {
    constructor(code, message, options = {}) {
      super(message || code, options);
      this.name = "MtProviderError";
      this.code = code;
      this.provider = options.provider || "";
      this.status = options.status || 0;
    }
  }

  const providers = new Map();
  let defaultId = "";

  function register(definition) {
    if (!definition || typeof definition.id !== "string" || !definition.id.trim()) {
      throw new TypeError("A machine-translation provider id is required.");
    }
    if (typeof definition.translate !== "function") {
      throw new TypeError("Provider " + definition.id + " must define translate().");
    }
    const id = definition.id.trim();
    if (providers.has(id)) throw new TypeError("Duplicate machine-translation provider: " + id);
    const provider = Object.freeze({
      id,
      name: definition.name || id,
      normalizeLanguage: typeof definition.normalizeLanguage === "function"
        ? definition.normalizeLanguage
        : code => String(code || "").trim(),
      translate: definition.translate
    });
    providers.set(id, provider);
    if (!defaultId || definition.default) defaultId = id;
    return provider;
  }

  function get(id) {
    return providers.get(String(id || "")) || null;
  }

  async function translate(id, request = {}) {
    const provider = get(id || defaultId);
    if (!provider) throw new MtProviderError("unknown-provider", "Unknown machine-translation provider.", { provider: id });
    const targetLanguage = provider.normalizeLanguage(request.targetLanguage);
    const sourceLanguage = provider.normalizeLanguage(request.sourceLanguage || "en");
    if (!targetLanguage) {
      throw new MtProviderError("target-language-required", "A target language is required.", { provider: provider.id });
    }
    return provider.translate({
      text: String(request.text || ""),
      sourceLanguage,
      targetLanguage,
      signal: request.signal
    });
  }

  register({
    id: "google",
    name: "Google",
    default: true,
    normalizeLanguage(code) {
      let value = String(code || "").trim().replace(/_/g, "-");
      if (!value) return "";
      if (/^pr(-br)?$/i.test(value)) value = "pt" + value.slice(2);
      const aliases = {
        "pt-br": "pt", "pt-pt": "pt",
        "zh-cn": "zh-CN", "zh-tw": "zh-TW", "zh-hk": "zh-TW",
        "es-419": "es", "es-es": "es", "es-mx": "es",
        "en-us": "en", "en-gb": "en",
        "nb-no": "no", "nn-no": "no"
      };
      return aliases[value.toLowerCase()] || value;
    },
    async translate({ text, sourceLanguage, targetLanguage, signal }) {
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + encodeURIComponent(sourceLanguage) + "&tl=" + encodeURIComponent(targetLanguage) + "&dt=t&q=" + encodeURIComponent(text);
      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new MtProviderError("http-error", "Google " + response.status, {
          provider: "google",
          status: response.status
        });
      }
      const payload = await response.json();
      const segments = payload && payload[0];
      if (!Array.isArray(segments)) {
        throw new MtProviderError("invalid-response", "Google returned an invalid response.", { provider: "google" });
      }
      return segments.map(segment => (segment && segment[0]) ? segment[0] : "").join("");
    }
  });

  globalThis.NecesseMtProviders = Object.freeze({
    register,
    get,
    has: id => providers.has(String(id || "")),
    getAll: () => [...providers.values()],
    translate,
    get defaultId() { return defaultId; },
    MtProviderError
  });
})();
