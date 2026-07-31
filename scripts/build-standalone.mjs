import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const [html, css, locales, app, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles/app.css"), "utf8"),
  readFile(resolve(source, "scripts/i18n/locales.js"), "utf8"),
  readFile(resolve(source, "scripts/app.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/loader.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/manager.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/matcher.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/qa.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/review.js"), "utf8"),
  readFile(resolve(source, "scripts/glossary/navigation.js"), "utf8")
]);

const originalHeader = `/* ============================================================================
   ЛОКАЛИЗАЦИЯ ИНТЕРФЕЙСА / UI LOCALIZATION
   Добавить язык: скопируйте блок и переведите значения. Ключи не меняйте.
   To add a language: copy a block and translate the values. Keep the keys.
   Плейсхолдеры вида {n}, {name} подставляются автоматически.
   ========================================================================== */`;
const standaloneLocales = locales.replace(/\/\* ={76}\n[\s\S]*?={74} \*\//, originalHeader);
const combinedApp = app.replace(
  "/* Interface locale data is loaded from ./i18n/locales.js. */",
  standaloneLocales.trimEnd()
);

const stripModuleSyntax = sourceText => sourceText
  .replace(/^import[^\n]+\n/gm, "")
  .replace(/^export\s+/gm, "");

const managerBundle = [glossaryLoader, glossaryManager].map(stripModuleSyntax).join("\n");
const qaBundle = [glossaryMatcher, glossaryQa].map(stripModuleSyntax).join("\n");
const reviewBundle = glossaryReview.replace(/^import[^\n]+\n/gm, "");
const bundledGlossary = `{\n${managerBundle}\n}\n{\n${qaBundle}\n}\n{\n${reviewBundle}\n}\n{\n${glossaryNavigation}\n}`;

const managerTag = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\.\/scripts\/glossary\/manager\.js["'])[^>]*><\/script>/i;
const qaTag = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\.\/scripts\/glossary\/qa\.js["'])[^>]*><\/script>\s*/i;
const reviewTag = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\.\/scripts\/glossary\/review\.js["'])[^>]*><\/script>\s*/i;
const localScriptTag = /<script\b[^>]*\bsrc=["']\.\/[^"']+["'][^>]*><\/script>\s*/gi;

let standalone = html
  .replace('<link rel="stylesheet" href="./styles/app.css">', `<style>${css}</style>`)
  .replace('<script src="./scripts/i18n/locales.js"></script>\n', "")
  .replace('<script src="./scripts/app.js"></script>', `<script>${combinedApp}</script>`)
  .replace(managerTag, `<script type="module">${bundledGlossary}</script>`)
  .replace(qaTag, "")
  .replace(reviewTag, "");

standalone = standalone.replace(localScriptTag, "");

await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/necesse-lang-translator.html"), standalone, "utf8");
console.log("Built dist/necesse-lang-translator.html");
