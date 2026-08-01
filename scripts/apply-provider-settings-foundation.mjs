import { readFile, writeFile } from "node:fs/promises";

async function replace(path, from, to) {
  const text = await readFile(path, "utf8");
  if (!text.includes(from)) throw new Error(`Expected text not found in ${path}`);
  await writeFile(path, text.replace(from, to), "utf8");
}

await replace(
  "src/index.html",
  '<script src="./scripts/mt/providers.js"></script>',
  '<script src="./scripts/mt/provider-settings.js"></script>\n<script src="./scripts/mt/providers.js"></script>'
);
await replace(
  "src/index.html",
  '<script src="./scripts/settings.js"></script>',
  '<script src="./scripts/settings.js"></script>\n<script src="./scripts/mt/provider-settings-ui.js"></script>'
);

const buildPath = "scripts/build-standalone.mjs";
let build = await readFile(buildPath, "utf8");
build = build.replace(
  "const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providers, app, settings, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([",
  "const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providerSettings, providers, app, settings, providerSettingsUi, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all(["
);
build = build.replace(
  '  readFile(resolve(source, "scripts/mt/providers.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/mt/provider-settings.js"), "utf8"),\n  readFile(resolve(source, "scripts/mt/providers.js"), "utf8"),'
);
build = build.replace(
  '  readFile(resolve(source, "scripts/settings.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/settings.js"), "utf8"),\n  readFile(resolve(source, "scripts/mt/provider-settings-ui.js"), "utf8"),'
);
build = build.replace(
  '${localeBootstrap.trimEnd()}\\n${providers.trimEnd()}`',
  '${localeBootstrap.trimEnd()}\\n${providerSettings.trimEnd()}\\n${providers.trimEnd()}`'
);
build = build.replace(
  '.replace(\'<script src="./scripts/mt/providers.js"></script>\\n\', "")',
  '.replace(\'<script src="./scripts/mt/provider-settings.js"></script>\\n\', "")\n  .replace(\'<script src="./scripts/mt/providers.js"></script>\\n\', "")'
);
build = build.replace(
  '.replace(\'<script src="./scripts/settings.js"></script>\', `<script>${settings}</script>`)',
  '.replace(\'<script src="./scripts/settings.js"></script>\', `<script>${settings}</script>`)\n  .replace(\'<script src="./scripts/mt/provider-settings-ui.js"></script>\', `<script>${providerSettingsUi}</script>`)'
);
await writeFile(buildPath, build, "utf8");

const testPath = "test/mt-provider-settings.test.mjs";
let tests = await readFile(testPath, "utf8");
tests += `\nconst providers = await readFile(new URL("../src/scripts/mt/providers.js", import.meta.url), "utf8");\nconst ui = await readFile(new URL("../src/scripts/mt/provider-settings-ui.js", import.meta.url), "utf8");\nconst html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");\nconst build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");\n\ntest("providers declare settings and receive resolved values", () => {\n  assert.match(providers, /NecesseMtProviderSettings\\?\\.define\\(id, settings\\)/);\n  assert.match(providers, /NecesseMtProviderSettings\\?\\.resolve\\(provider\\.id\\)/);\n  assert.match(providers, /signal: request\\.signal,\\s*settings/);\n});\n\ntest("Settings renders provider-declared fields without persisting secrets", () => {\n  assert.match(ui, /field\\.type === "secret" \\? "password" : "text"/);\n  assert.match(ui, /store\\?\\.setSecret/);\n  assert.match(ui, /store\\?\\.setPublic/);\n  assert.doesNotMatch(ui, /localStorage|document\\.cookie/);\n});\n\ntest("hosted and standalone builds load provider settings", () => {\n  assert.match(html, /provider-settings\\.js/);\n  assert.match(html, /provider-settings-ui\\.js/);\n  assert.match(build, /providerSettings/);\n  assert.match(build, /providerSettingsUi/);\n});\n`;
await writeFile(testPath, tests, "utf8");

console.log("Applied provider settings foundation integration.");
