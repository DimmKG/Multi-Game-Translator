import { readFile, writeFile } from "node:fs/promises";

async function replace(path, from, to) {
  const text = await readFile(path, "utf8");
  if (!text.includes(from)) throw new Error(`Expected text not found in ${path}`);
  await writeFile(path, text.replace(from, to), "utf8");
}

await replace(
  "src/index.html",
  '<script src="./scripts/settings.js"></script>',
  '<script src="./scripts/settings.js"></script>\n<script src="./scripts/font-settings.js"></script>'
);

const buildPath = "scripts/build-standalone.mjs";
let build = await readFile(buildPath, "utf8");
build = build.replace(
  "const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providerSettings, secretVault, providers, app, settings, providerSettingsUi, secretVaultUi, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([",
  "const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providerSettings, secretVault, providers, app, settings, fontSettings, providerSettingsUi, secretVaultUi, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all(["
);
build = build.replace(
  '  readFile(resolve(source, "scripts/settings.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/settings.js"), "utf8"),\n  readFile(resolve(source, "scripts/font-settings.js"), "utf8"),'
);
build = build.replace(
  '.replace(\'<script src="./scripts/settings.js"></script>\', `<script>${settings}</script>`)',
  '.replace(\'<script src="./scripts/settings.js"></script>\', `<script>${settings}</script>`)\n  .replace(\'<script src="./scripts/font-settings.js"></script>\', `<script>${fontSettings}</script>`)'
);
await writeFile(buildPath, build, "utf8");

const testPath = "test/font-settings.test.mjs";
let tests = await readFile(testPath, "utf8");
tests += `\nconst html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");\nconst build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");\n\ntest("hosted and standalone builds load font settings", () => {\n  assert.match(html, /font-settings\\.js/);\n  assert.match(build, /fontSettings/);\n});\n`;
await writeFile(testPath, tests, "utf8");

console.log("Applied font settings integration.");
