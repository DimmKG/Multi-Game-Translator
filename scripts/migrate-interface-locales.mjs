import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = resolve(root, "src/scripts/app.js");
const indexPath = resolve(root, "src/index.html");
const localePath = resolve(root, "src/scripts/i18n/locales.js");
const buildPath = resolve(root, "scripts/build-standalone.mjs");
const validatorPath = resolve(root, "scripts/validate-locales.mjs");
const packagePath = resolve(root, "package.json");
const readmePath = resolve(root, "README.md");
const docsPath = resolve(root, "docs/interface-localization.md");
const workflowPath = resolve(root, ".github/workflows/validate.yml");

const app = await readFile(appPath, "utf8");
const start = app.indexOf("/* ============================================================================");
const iife = app.indexOf("(function(){", start);
if (start < 0 || iife < 0) throw new Error("Could not locate the embedded interface locale block.");

const embedded = app.slice(start, iife).trimEnd();
const englishHeader = `/* ============================================================================
   INTERFACE LOCALIZATION
   To add a built-in language, copy an existing locale block and translate only
   the values. Keep all message keys and placeholders such as {n} and {name}.
   ========================================================================== */`;
const locales = embedded.replace(/\/\*[\s\S]*?\*\//, englishHeader) + "\n";

await mkdir(dirname(localePath), { recursive: true });
await writeFile(localePath, locales, "utf8");
await writeFile(appPath, app.slice(0, start) + "/* Interface locale data is loaded from ./i18n/locales.js. */\n" + app.slice(iife), "utf8");

let index = await readFile(indexPath, "utf8");
index = index.replace(
  '<script src="./scripts/app.js"></script>',
  '<script src="./scripts/i18n/locales.js"></script>\n<script src="./scripts/app.js"></script>'
);
await writeFile(indexPath, index, "utf8");

const build = `import { mkdir, readFile, writeFile } from "node:fs/promises";
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

const originalHeader = \`/* ============================================================================
   ЛОКАЛИЗАЦИЯ ИНТЕРФЕЙСА / UI LOCALIZATION
   Добавить язык: скопируйте блок и переведите значения. Ключи не меняйте.
   To add a language: copy a block and translate the values. Keep the keys.
   Плейсхолдеры вида {n}, {name} подставляются автоматически.
   ========================================================================== */\`;
const standaloneLocales = locales.replace(/\\/\\* ={76}\\n[\\s\\S]*?={74} \\*\\//, originalHeader);
const combined = app.replace(
  "/* Interface locale data is loaded from ./i18n/locales.js. */",
  standaloneLocales.trimEnd()
);
const standalone = html
  .replace('<link rel="stylesheet" href="./styles/app.css">', \`<style>\${css}</style>\`)
  .replace('<script src="./scripts/i18n/locales.js"></script>\\n', "")
  .replace('<script src="./scripts/app.js"></script>', \`<script>\${combined}</script>\`);
await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/necesse-lang-translator.html"), standalone, "utf8");
console.log("Built dist/necesse-lang-translator.html");
`;
await writeFile(buildPath, build, "utf8");

const validator = `import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "src/scripts/i18n/locales.js");
const source = await readFile(path, "utf8");
const context = vm.createContext(Object.create(null));
vm.runInContext(\`\${source}\\n;globalThis.__I18N__ = I18N;\`, context, { filename: path, timeout: 1000 });
const locales = context.__I18N__;
if (!locales || typeof locales !== "object" || Array.isArray(locales)) throw new Error("Locale source must define an I18N object.");
if (!locales.en) throw new Error("The English fallback locale is missing.");
const baseKeys = Object.keys(locales.en);
const baseSet = new Set(baseKeys);
const tokens = value => [...String(value).matchAll(/\\{([A-Za-z][A-Za-z0-9_]*)\\}/g)].map(x => x[1]).sort();
const errors = [];
for (const [code, messages] of Object.entries(locales)) {
  if (!messages || typeof messages !== "object" || Array.isArray(messages)) { errors.push(\`\${code}: locale must be an object\`); continue; }
  const keys = Object.keys(messages);
  const keySet = new Set(keys);
  const missing = baseKeys.filter(key => !keySet.has(key));
  const unknown = keys.filter(key => !baseSet.has(key));
  if (missing.length) errors.push(\`\${code}: missing keys: \${missing.join(", ")}\`);
  if (unknown.length) errors.push(\`\${code}: unknown keys: \${unknown.join(", ")}\`);
  for (const key of baseKeys) {
    if (!keySet.has(key)) continue;
    if (typeof messages[key] !== "string") { errors.push(\`\${code}.\${key}: value must be a string\`); continue; }
    if (tokens(locales.en[key]).join("\\0") !== tokens(messages[key]).join("\\0")) errors.push(\`\${code}.\${key}: placeholders differ\`);
  }
}
if (errors.length) { console.error("Interface locale validation failed:\\n" + errors.map(x => \`- \${x}\`).join("\\n")); process.exit(1); }
console.log(\`Validated \${Object.keys(locales).length} interface locales with \${baseKeys.length} keys each.\`);
`;
await writeFile(validatorPath, validator, "utf8");

const pkg = JSON.parse(await readFile(packagePath, "utf8"));
pkg.scripts["validate:locales"] = "node scripts/validate-locales.mjs";
pkg.scripts.verify = "npm run validate:locales && npm run validate:glossaries && npm run build && npm run check";
await writeFile(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

let readme = await readFile(readmePath, "utf8");
readme = readme.replace("- `src/scripts/app.js` - current application logic", "- `src/scripts/app.js` - application logic\n- `src/scripts/i18n/locales.js` - built-in interface languages");
readme = readme.replace("GitHub Actions runs the same verification automatically for pushes and pull requests.", "GitHub Actions runs the same verification automatically for pushes and pull requests. `npm run verify` validates both interface locales and glossaries before rebuilding the standalone file.");
await writeFile(readmePath, readme, "utf8");

await mkdir(dirname(docsPath), { recursive: true });
await writeFile(docsPath, `# Interface localization\n\nBuilt-in interface messages live in \`src/scripts/i18n/locales.js\`. English is the required fallback locale.\n\n## Adding a built-in locale\n\n1. Copy an existing locale object.\n2. Use a valid language code as its key.\n3. Translate values only. Do not rename message keys.\n4. Preserve placeholders such as \`{n}\`, \`{name}\` and \`{file}\`.\n5. Run \`npm run validate:locales\`.\n\nThe validator requires every locale to contain exactly the English key set and the same placeholders for each message.\n\nThe standalone build embeds all built-in locales into one HTML file, so direct offline use remains supported. A future locale-pack importer will allow additional languages to be loaded locally without rebuilding the application.\n`, "utf8");

const normalWorkflow = `name: Validate project\n\non:\n  push:\n    branches:\n      - main\n      - "agent/**"\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Check out repository\n        uses: actions/checkout@v4\n      - name: Set up Node.js\n        uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - name: Verify project\n        run: npm run verify\n`;
await writeFile(workflowPath, normalWorkflow, "utf8");
await unlink(fileURLToPath(import.meta.url));
console.log("Interface locale migration completed.");
