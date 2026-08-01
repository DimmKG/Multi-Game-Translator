import { mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(".");
const i18nDir = resolve(root, "src/scripts/i18n");
const localeDir = resolve(i18nDir, "locales");
const monolithPath = resolve(i18nDir, "locales.js");
const settingsMessagesPath = resolve(i18nDir, "settings-messages.js");
const bootstrapPath = resolve(i18nDir, "locale-bootstrap.js");

const localeSource = await readFile(monolithPath, "utf8");
const settingsSource = await readFile(settingsMessagesPath, "utf8");
const bootstrapSource = await readFile(bootstrapPath, "utf8");

function evaluateObjectLiteral(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not extract object after ${startMarker}`);
  const literal = source.slice(start + startMarker.length, end).trim();
  return vm.runInNewContext(`(${literal})`, Object.create(null));
}

const localeContext = Object.create(null);
vm.createContext(localeContext);
vm.runInContext(`${localeSource}\nglobalThis.__I18N = I18N;`, localeContext);
const sourceLocales = localeContext.__I18N;
const extensionMessages = evaluateObjectLiteral(bootstrapSource, "const extensions =", ";\n\n  for (const code");
const settingsMessages = evaluateObjectLiteral(settingsSource, "const messages =", ";\n\n  for (const [code");

for (const [code, messages] of Object.entries(extensionMessages)) {
  sourceLocales[code] = { ...(sourceLocales[code] || {}), ...messages };
}
for (const [code, messages] of Object.entries(settingsMessages)) {
  sourceLocales[code] = { ...(sourceLocales[code] || {}), ...messages };
}

const codes = Object.keys(sourceLocales).sort((a, b) => {
  if (a === "en") return -1;
  if (b === "en") return 1;
  return a.localeCompare(b);
});

await rm(localeDir, { recursive: true, force: true });
await mkdir(localeDir, { recursive: true });

function languageName(code, locale) {
  try { return new Intl.DisplayNames([locale], { type: "language" }).of(code) || code; }
  catch { return code; }
}

for (const code of codes) {
  const name = languageName(code, "en");
  const nativeName = languageName(code, code);
  const reviewed = ["en", "bg", "ru"].includes(code);
  const file = `"use strict";\n\nglobalThis.NecesseLocales.register({\n  code: ${JSON.stringify(code)},\n  name: ${JSON.stringify(name)},\n  nativeName: ${JSON.stringify(nativeName)},\n  reviewed: ${reviewed},\n  messages: ${JSON.stringify(sourceLocales[code], null, 2)}\n});\n`;
  await writeFile(resolve(localeDir, `${code}.js`), file, "utf8");
}

const registry = `"use strict";

/*
 * Built-in interface locales.
 *
 * English, Bulgarian and Russian are human-maintained.
 * All other translations were generated with AI and should be treated as
 * provisional until reviewed and corrected by native speakers.
 *
 * Missing message keys intentionally fall back to English.
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
    if (locales.has(code)) throw new TypeError(`Duplicate built-in locale: ${code}`);
    if (code !== "en" && !I18N.en) throw new Error("The English locale must be registered first.");
    I18N[code] = Object.freeze(code === "en" ? { ...locale.messages } : { ...I18N.en, ...locale.messages });
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
`;
await writeFile(monolithPath, registry, "utf8");

const bootstrap = `"use strict";

(function initializeSharedInterfaceI18n() {
  const language = () => document.getElementById("uiLang")?.value || "en";
  const translate = (key, vars) => {
    const locale = I18N[language()] || I18N.en;
    let value = locale?.[key] != null ? locale[key] : (I18N.en?.[key] != null ? I18N.en[key] : key);
    if (vars) for (const [name, replacement] of Object.entries(vars)) value = String(value).split(`{${name}}`).join(String(replacement));
    return String(value);
  };
  const plural = (base, count, vars = {}) => translate(`${base}.${count === 1 ? "one" : "other"}`, { ...vars, n: count });
  globalThis.NecesseI18n = Object.freeze({ t: translate, plural });
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
  } catch { /* Ignore invalid or unavailable saved locale data. */ }
})();
`;
await writeFile(bootstrapPath, bootstrap, "utf8");
await unlink(settingsMessagesPath);

const indexPath = resolve(root, "src/index.html");
let index = await readFile(indexPath, "utf8");
index = index.replace(/<select id="uiLang" class="uilang" aria-label="Interface language">[\s\S]*?<\/select>/, '<select id="uiLang" class="uilang" aria-label="Interface language"></select>');
index = index.replace(/\s*<script src="\.\/scripts\/i18n\/settings-messages\.js"><\/script>\n?/, "\n");
const localeTags = [
  '<script src="./scripts/i18n/locales.js"></script>',
  ...codes.map(code => `<script src="./scripts/i18n/locales/${code}.js"></script>`)
].join("\n");
index = index.replace('<script src="./scripts/i18n/locales.js"></script>', localeTags);
await writeFile(indexPath, index, "utf8");

const buildPath = resolve(root, "scripts/build-standalone.mjs");
const build = `import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const localeDirectory = resolve(source, "scripts/i18n/locales");
const localeNames = (await readdir(localeDirectory)).filter(name => name.endsWith(".js")).sort((a, b) => {
  if (a === "en.js") return -1;
  if (b === "en.js") return 1;
  return a.localeCompare(b);
});
const localeSources = await Promise.all(localeNames.map(name => readFile(resolve(localeDirectory, name), "utf8")));
const [html, css, localeRegistry, localeBootstrap, localePackages, app, settings, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles/app.css"), "utf8"),
  readFile(resolve(source, "scripts/i18n/locales.js"), "utf8"),
  readFile(resolve(source, "scripts/i18n/locale-bootstrap.js"), "utf8"),
  readFile(resolve(source, "scripts/i18n/locale-packages.js"), "utf8"),
  readFile(resolve(source, "scripts/app.js"), "utf8"),
  readFile(resolve(source, "scripts/settings.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/loader.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/manager.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/matcher.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/qa.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/review.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/navigation.js"), "utf8")
]);

const standaloneLocales = [localeRegistry, ...localeSources].join("\n");
const combinedApp = app.replace(
  "/* Interface locale data is loaded from ./i18n/locales.js. */",
  `${standaloneLocales.trimEnd()}\n${localeBootstrap.trimEnd()}`
);

const stripModuleSyntax = sourceText => sourceText
  .replace(/^import[^\n]+\n/gm, "")
  .replace(/^export\s+/gm, "");

const managerBundle = [glossaryLoader, glossaryManager].map(stripModuleSyntax).join("\n");
const qaBundle = [glossaryMatcher, glossaryQa].map(stripModuleSyntax).join("\n");
const reviewBundle = glossaryReview.replace(/^import[^\n]+\n/gm, "");
const bundledGlossary = `{\n${managerBundle}\n}\n{\n${qaBundle}\n}\n{\n${reviewBundle}\n}\n{\n${glossaryNavigation}\n}`;
const bundledLocalePackages = `{\n${stripModuleSyntax(localePackages)}\n}`;

const localePackageTag = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\.\/scripts\/i18n\/locale-packages\.js["'])[^>]*><\/script>/i;
const managerTag = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\.\/scripts\/glossary\/manager\.js["'])[^>]*><\/script>/i;
const qaTag = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\.\/scripts\/glossary\/qa\.js["'])[^>]*><\/script>\s*/i;
const reviewTag = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\.\/scripts\/glossary\/review\.js["'])[^>]*><\/script>\s*/i;
const localScriptTag = /<script\b[^>]*\bsrc=["']\.\/[^"']+["'][^>]*><\/script>\s*/gi;

let standalone = html
  .replace('<link rel="stylesheet" href="./styles/app.css">', `<style>${css}</style>`)
  .replace('<script src="./scripts/app.js"></script>', `<script>${combinedApp}</script>`)
  .replace('<script src="./scripts/settings.js"></script>', `<script>${settings}</script>`)
  .replace(localePackageTag, `<script type="module">${bundledLocalePackages}</script>`)
  .replace(managerTag, `<script type="module">${bundledGlossary}</script>`)
  .replace(qaTag, "")
  .replace(reviewTag, "");

standalone = standalone.replace(localScriptTag, "");

await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/necesse-lang-translator.html"), standalone, "utf8");
console.log(`Built dist/necesse-lang-translator.html with ${localeNames.length} built-in locales.`);
`;
await writeFile(buildPath, build, "utf8");

const validatorPath = resolve(root, "scripts/validate-interface-locales.mjs");
const validator = `import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(".");
const directory = resolve(root, "interface-locales");
const builtInDirectory = resolve(root, "src/scripts/i18n/locales");
const registrySource = await readFile(resolve(root, "src/scripts/i18n/locales.js"), "utf8");
const builtInFiles = (await readdir(builtInDirectory)).filter(name => name.endsWith(".js")).sort((a, b) => a === "en.js" ? -1 : b === "en.js" ? 1 : a.localeCompare(b));
const context = {
  document: { getElementById: () => null, createElement: () => ({}) },
  console
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(registrySource, context);
for (const name of builtInFiles) vm.runInContext(await readFile(resolve(builtInDirectory, name), "utf8"), context);
const englishKeys = new Set(Object.keys(context.I18N.en));
const builtins = new Set(context.NecesseLocales.getAll().map(locale => locale.code));
const codePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const failures = [];
let checked = 0;

async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (extname(entry.name).toLowerCase() === ".json") files.push(child);
  }
  return files;
}

for (const file of await filesUnder(directory)) {
  checked++;
  let locale;
  try { locale = JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, "")); }
  catch (error) { failures.push(`${file}: invalid JSON: ${error.message}`); continue; }

  if (!locale || typeof locale !== "object" || Array.isArray(locale)) failures.push(`${file}: package must be an object`);
  if (locale.format !== "necesse-interface-locale" || locale.version !== 1) failures.push(`${file}: unsupported format or version`);
  if (typeof locale.code !== "string" || !codePattern.test(locale.code)) failures.push(`${file}: invalid language code`);
  if (builtins.has(locale.code)) failures.push(`${file}: built-in language codes cannot be replaced`);
  if (typeof locale.name !== "string" || !locale.name.trim()) failures.push(`${file}: name is required`);
  if (typeof locale.nativeName !== "string" || !locale.nativeName.trim()) failures.push(`${file}: nativeName is required`);
  if (!locale.messages || typeof locale.messages !== "object" || Array.isArray(locale.messages)) {
    failures.push(`${file}: messages must be an object`);
    continue;
  }
  const entries = Object.entries(locale.messages);
  if (!entries.length) failures.push(`${file}: messages must not be empty`);
  for (const [key, value] of entries) {
    if (!englishKeys.has(key)) failures.push(`${file}: unknown message key ${key}`);
    if (typeof value !== "string") failures.push(`${file}: message ${key} must be a string`);
  }
}

if (failures.length) {
  console.error("Interface locale validation failed:\n" + failures.map(item => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${checked} interface locale package${checked === 1 ? "" : "s"} against ${builtins.size} built-in locales.`);
}
`;
await writeFile(validatorPath, validator, "utf8");

const settingsTestPath = resolve(root, "test/settings.test.mjs");
let settingsTest = await readFile(settingsTestPath, "utf8");
settingsTest = settingsTest.replace('const messages = await readFile(new URL("../src/scripts/i18n/settings-messages.js", import.meta.url), "utf8");\n', 'const english = await readFile(new URL("../src/scripts/i18n/locales/en.js", import.meta.url), "utf8");\n');
settingsTest = settingsTest.replace(/\s*const messageIndex[\s\S]*?assert\.ok\(settingsIndex > bootstrapIndex\);/, `\n  const registryIndex = index.indexOf("scripts/i18n/locales.js");\n  const englishIndex = index.indexOf("scripts/i18n/locales/en.js");\n  const bootstrapIndex = index.indexOf("locale-bootstrap.js");\n  const settingsIndex = index.indexOf("scripts/settings.js");\n  assert.ok(registryIndex >= 0);\n  assert.ok(englishIndex > registryIndex);\n  assert.ok(bootstrapIndex > englishIndex);\n  assert.ok(settingsIndex > bootstrapIndex);`);
settingsTest = settingsTest.replace(/test\("settings messages are shared through I18N"[\s\S]*?\n\}\);/, `test("settings messages live in the English locale", () => {\n  assert.match(english, /settings\\.referenceReminder/);\n  assert.match(english, /NecesseLocales\\.register/);\n});`);
settingsTest = settingsTest.replace(/\s*assert\.match\(build, \/settings-messages\\\.js\/\);/, "");
await writeFile(settingsTestPath, settingsTest, "utf8");

const checkBuildPath = resolve(root, "scripts/check-build.mjs");
let checkBuild = await readFile(checkBuildPath, "utf8");
checkBuild = checkBuild.replace('requireText("const I18N = {", "embedded interface locales");', 'requireText("initializeLocaleRegistry", "embedded locale registry");\nrequireText("NecesseLocales.register", "embedded built-in interface locales");');
await writeFile(checkBuildPath, checkBuild, "utf8");

const readmePath = resolve(root, "README.md");
let readme = await readFile(readmePath, "utf8");
readme = readme.replace('`src/scripts/i18n/locales.js` - built-in interface languages', '`src/scripts/i18n/locales.js` - built-in locale registry\n- `src/scripts/i18n/locales/*.js` - one file per built-in interface language');
await writeFile(readmePath, readme, "utf8");

await unlink(resolve(root, ".github/workflows/split-locales.yml"));
await unlink(resolve(root, "scripts/split-built-in-locales.mjs"));

console.log(`Split ${codes.length} built-in locales: ${codes.join(", ")}`);
