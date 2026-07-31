import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const sourceDir = resolve(rootDir, "src");
const outputDir = resolve(rootDir, "dist");

const [html, css, js] = await Promise.all([
  readFile(resolve(sourceDir, "index.html"), "utf8"),
  readFile(resolve(sourceDir, "styles/app.css"), "utf8"),
  readFile(resolve(sourceDir, "scripts/app.js"), "utf8")
]);

const standalone = html
  .replace('<link rel="stylesheet" href="./styles/app.css">', `<style>${css}</style>`)
  .replace('<script src="./scripts/app.js"></script>', `<script>${js}</script>`);

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "necesse-lang-translator.html"), standalone, "utf8");
console.log("Built dist/necesse-lang-translator.html");
