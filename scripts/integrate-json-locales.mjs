import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");

async function update(path, transform) {
  const absolute = resolve(root, path);
  const before = await readFile(absolute, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(path + ": expected migration pattern was not found");
  await writeFile(absolute, after, "utf8");
}

await update("src/index.html", source => source
  .replace(/<select id="uiLang" class="uilang" aria-label="Interface language">[\s\S]*?<\/select>/, '<select id="uiLang" class="uilang" aria-label="Interface language"></select>')
  .replace(
    '<script src="./scripts/i18n/locales.js"></script>\n<script src="./scripts/i18n/settings-messages.js"></script>\n<script src="./scripts/i18n/locale-bootstrap.js"></script>',
    '<script src="./scripts/i18n/locales.js"></script>\n<script src="./scripts/i18n/built-in-locales.generated.js"></script>\n<script src="./scripts/i18n/locale-bootstrap.js"></script>'
  ));

await update("scripts/build-standalone.mjs", source => source
  .replace(
    'const [html, css, locales, settingsMessages, localeBootstrap, localePackages, app, settings, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([',
    'const [html, css, locales, builtInLocales, localeBootstrap, localePackages, app, settings, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all(['
  )
  .replace(
    '  readFile(resolve(source, "scripts/i18n/locales.js"), "utf8"),\n  readFile(resolve(source, "scripts/i18n/settings-messages.js"), "utf8"),\n  readFile(resolve(source, "scripts/i18n/locale-bootstrap.js"), "utf8"),',
    '  readFile(resolve(source, "scripts/i18n/locales.js"), "utf8"),\n  readFile(resolve(source, "scripts/i18n/built-in-locales.generated.js"), "utf8"),\n  readFile(resolve(source, "scripts/i18n/locale-bootstrap.js"), "utf8"),'
  )
  .replace(
    '  `${standaloneLocales.trimEnd()}\\n${settingsMessages.trimEnd()}\\n${localeBootstrap.trimEnd()}`',
    '  `${standaloneLocales.trimEnd()}\\n${builtInLocales.trimEnd()}\\n${localeBootstrap.trimEnd()}`'
  )
  .replace('  .replace(\'<script src="./scripts/i18n/settings-messages.js"></script>\\n\', "")\n', '')
  .replace(
    '  .replace(\'<script src="./scripts/i18n/locales.js"></script>\\n\', "")\n',
    '  .replace(\'<script src="./scripts/i18n/locales.js"></script>\\n\', "")\n  .replace(\'<script src="./scripts/i18n/built-in-locales.generated.js"></script>\\n\', "")\n'
  ));

await update("scripts/check-build.mjs", source => source
  .replace('requireText("const I18N = {", "embedded interface locales");', 'requireText("NecesseLocales.register", "embedded generated interface locales");\nrequireText("GENERATED FILE — DO NOT EDIT", "generated locale bundle marker");'));

await update("test/settings.test.mjs", source => source
  .replace('const messages = await readFile(new URL("../src/scripts/i18n/settings-messages.js", import.meta.url), "utf8");', 'const englishLocale = JSON.parse(await readFile(new URL("../src/scripts/i18n/locales/en.json", import.meta.url), "utf8"));')
  .replace('  assert.match(messages, /settings\\.referenceReminder/);\n  assert.match(messages, /globalThis\\.I18N/);\n  assert.match(messages, /NecesseSettingsMessages/);', '  assert.equal(englishLocale.messages["settings.referenceReminder"], "Highlight missing en.lang reference");\n  assert.equal(englishLocale.messages["settings.close"], "Close");')
  .replace('  assert.match(build, /settings-messages\\.js/);', '  assert.match(build, /built-in-locales\\.generated\\.js/);'));

console.log("Integrated generated JSON locale assets into runtime, standalone build and tests.");
