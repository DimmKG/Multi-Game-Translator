import { readFile, writeFile, mkdir } from "node:fs/promises";

async function replace(path, search, replacement, label) {
  const source = await readFile(path, "utf8");
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Could not apply ${label} to ${path}`);
  await writeFile(path, next, "utf8");
}

const providers = `"use strict";

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
`;

await mkdir("src/scripts/mt", { recursive: true });
await writeFile("src/scripts/mt/providers.js", providers, "utf8");

await replace(
  "src/index.html",
  '<script src="./scripts/i18n/locale-bootstrap.js"></script>\n<script src="./scripts/app.js"></script>',
  '<script src="./scripts/i18n/locale-bootstrap.js"></script>\n<script src="./scripts/mt/providers.js"></script>\n<script src="./scripts/app.js"></script>\n<script src="./scripts/mt/target-language.js"></script>',
  "hosted MT script order"
);

await replace(
  "src/index.html",
  '<span class="mtprov" data-i18n="mt.google" data-i18n-title="mt.providerTitle"></span>',
  '<select class="mtprov" id="mtProvider" data-i18n-title="mt.providerTitle" aria-label="Machine translation provider"></select>',
  "provider selector markup"
);

await replace(
  "src/scripts/glossary/navigation.js",
  /function loadMtTargetLanguageControls\(\) \{[\s\S]*?\n\}\n\nif \(document\.readyState === "loading"\) \{[\s\S]*?\n\} else \{[\s\S]*?\n\}/,
  'if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startTerminologyNavigation);\nelse startTerminologyNavigation();',
  "direct MT target loading"
);

await replace(
  "src/scripts/app.js",
  /  \/\/ Only these remain; sessions saved with a removed provider[\s\S]*?  function currentTargetLang\(\)\{[\s\S]*?\n  \}/,
`  const MT_PROVIDER_KEY = "necesse-translator.mt-provider.v1";
  function providerRegistry(){ return globalThis.NecesseMtProviders || null; }
  function validProvider(provider){
    const registry = providerRegistry();
    return registry && registry.has(provider) ? provider : (registry?.defaultId || "google");
  }
  function preferredProvider(){
    try { return validProvider(localStorage.getItem(MT_PROVIDER_KEY)); }
    catch(e) { return validProvider(""); }
  }
  function setPreferredProvider(provider){
    try { localStorage.setItem(MT_PROVIDER_KEY, validProvider(provider)); } catch(e) {}
  }
  function decodeEntities(s){ const t = document.createElement("textarea"); t.innerHTML = s; return t.value; }

  function currentTargetLang(){
    const live = (($("mtTarget") && $("mtTarget").value) || "").trim();
    if (live) state.targetLang = live;
    return state.targetLang || "";
  }`,
  "provider helpers"
);

await replace(
  "src/scripts/app.js",
  /  async function callProvider\(provider, text, target\)\{[\s\S]*?\n  \}\n\n  async function mtTranslate/,
`  async function callProvider(provider, text, target){
    const registry = providerRegistry();
    if (!registry) throw new Error(t("mt.errUnknownProvider"));
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 13000);
    try{
      return await registry.translate(validProvider(provider), {
        text,
        sourceLanguage: "en",
        targetLanguage: target,
        signal: ctl.signal
      });
    } catch(err){
      if (err.name === "AbortError") throw new Error(t("mt.errTimeout"));
      if (err instanceof TypeError) throw new Error(t("mt.errNetwork"));
      if (err.code === "invalid-response") throw new Error(t("mt.errGoogle"));
      if (err.code === "unknown-provider") throw new Error(t("mt.errUnknownProvider"));
      throw err;
    } finally { clearTimeout(to); }
  }

  async function mtTranslate`,
  "provider delegation"
);

await replace(
  "src/scripts/app.js",
  '    state.mtProvider = validProvider(state.mtProvider);\n    $("mtTarget").value = state.targetLang;',
`    state.mtProvider = validProvider(state.mtProvider);
    const providerSelect = $("mtProvider");
    if (providerSelect){
      providerSelect.innerHTML = "";
      const registry = providerRegistry();
      for (const provider of (registry ? registry.getAll() : [])){
        const option = document.createElement("option");
        option.value = provider.id;
        option.textContent = provider.name;
        providerSelect.appendChild(option);
      }
      providerSelect.value = state.mtProvider;
      providerSelect.disabled = providerSelect.options.length < 2;
    }
    $("mtTarget").value = state.targetLang;`,
  "provider selector population"
);

await replace(
  "src/scripts/app.js",
  '    state.eol = eol; state.items = items; state.filename = cleanName(filename);\n    state.targetLang = targetFromName(state.filename);',
  '    state.eol = eol; state.items = items; state.filename = cleanName(filename);\n    state.mtProvider = preferredProvider();\n    state.targetLang = targetFromName(state.filename);',
  "new-project preferred provider"
);

await replace(
  "src/scripts/app.js",
  '  // MT + spellcheck controls\n  // Push spellcheck settings onto already-rendered textareas — never rebuild the list.',
`  // MT + spellcheck controls
  $("mtProvider")?.addEventListener("change", event => {
    state.mtProvider = validProvider(event.target.value);
    event.target.value = state.mtProvider;
    setPreferredProvider(state.mtProvider);
    scheduleSave();
  });
  // Push spellcheck settings onto already-rendered textareas — never rebuild the list.`,
  "provider selector behavior"
);

await replace(
  "scripts/build-standalone.mjs",
  'const [html, css, locales, builtInLocales, localeBootstrap, localePackages, app, settings, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([',
  'const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providers, app, settings, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([',
  "standalone provider binding"
);

await replace(
  "scripts/build-standalone.mjs",
  '  readFile(resolve(source, "scripts/i18n/locale-packages.js"), "utf8"),\n  readFile(resolve(source, "scripts/app.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/i18n/locale-packages.js"), "utf8"),\n  readFile(resolve(source, "scripts/mt/providers.js"), "utf8"),\n  readFile(resolve(source, "scripts/app.js"), "utf8"),',
  "standalone provider source"
);

await replace(
  "scripts/build-standalone.mjs",
  '  `${standaloneLocales.trimEnd()}\\n${builtInLocales.trimEnd()}\\n${localeBootstrap.trimEnd()}`\n);',
  '  `${standaloneLocales.trimEnd()}\\n${builtInLocales.trimEnd()}\\n${localeBootstrap.trimEnd()}\\n${providers.trimEnd()}`\n) + `\\n${targetLanguage.trimEnd()}`;',
  "standalone provider bundle"
);

await replace(
  "scripts/build-standalone.mjs",
  '.replace(\'<script src="./scripts/i18n/locale-bootstrap.js"></script>\\n\', "")\n  .replace(\'<script src="./scripts/app.js"></script>\', `<script>${combinedApp}</script>`)',
  '.replace(\'<script src="./scripts/i18n/locale-bootstrap.js"></script>\\n\', "")\n  .replace(\'<script src="./scripts/mt/providers.js"></script>\\n\', "")\n  .replace(\'<script src="./scripts/app.js"></script>\', `<script>${combinedApp}</script>`)\n  .replace(\'<script src="./scripts/mt/target-language.js"></script>\\n\', "")',
  "standalone MT script removal"
);

const tests = `import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const providers = await readFile(new URL("../src/scripts/mt/providers.js", import.meta.url), "utf8");
const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");

test("machine translation providers use a shared registry", () => {
  assert.match(providers, /function register\(definition\)/);
  assert.match(providers, /async function translate\(id, request/);
  assert.match(providers, /globalThis\.NecesseMtProviders/);
  assert.match(providers, /id: "google"/);
});

test("Google-specific language aliases live in the Google provider", () => {
  assert.match(providers, /"pt-br": "pt"/);
  assert.match(providers, /"zh-tw": "zh-TW"/);
  assert.match(providers, /\^pr\(-br\)\?/);
  assert.doesNotMatch(app, /function normalizeMtLang/);
});

test("the editor delegates translation through the provider registry", () => {
  assert.match(app, /registry\.translate\(validProvider\(provider\)/);
  assert.match(app, /sourceLanguage: "en"/);
  assert.match(app, /targetLanguage: target/);
});

test("provider selection is visible and remembered", () => {
  assert.match(html, /id="mtProvider"/);
  assert.match(app, /necesse-translator\.mt-provider\.v1/);
  assert.match(app, /setPreferredProvider\(state\.mtProvider\)/);
  assert.match(app, /providerSelect\.disabled = providerSelect\.options\.length < 2/);
});

test("hosted and standalone builds load provider code before the app", () => {
  assert.ok(html.indexOf("scripts/mt/providers.js") < html.indexOf("scripts/app.js"));
  assert.match(build, /scripts\/mt\/providers\.js/);
  assert.match(build, /providers\.trimEnd\(\)/);
});
`;
await writeFile("test/mt-providers.test.mjs", tests, "utf8");

console.log("Applied machine-translation provider abstraction.");
