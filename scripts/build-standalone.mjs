import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const [html, css, locales, app] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles/app.css"), "utf8"),
  readFile(resolve(source, "scripts/i18n/locales.js"), "utf8"),
  readFile(resolve(source, "scripts/app.js"), "utf8")
]);

const originalHeader = `/* ============================================================================
   ЛОКАЛИЗАЦИЯ ИНТЕРФЕЙСА / UI LOCALIZATION
   Добавить язык: скопируйте блок и переведите значения. Ключи не меняйте.
   To add a language: copy a block and translate the values. Keep the keys.
   Плейсхолдеры вида {n}, {name} подставляются автоматически.
   ========================================================================== */`;
const standaloneLocales = locales.replace(/\/\* ={76}\n[\s\S]*?={74} \*\//, originalHeader);
const combined = app.replace(
  "/* Interface locale data is loaded from ./i18n/locales.js. */",
  standaloneLocales.trimEnd()
);
const standalone = html
  .replace('<link rel="stylesheet" href="./styles/app.css">', `<style>${css}</style>`)
  .replace('<script src="./scripts/i18n/locales.js"></script>\n', "")
  .replace('<script src="./scripts/app.js"></script>', `<script>${combined}</script>`);
await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/necesse-lang-translator.html"), standalone, "utf8");
console.log("Built dist/necesse-lang-translator.html");
