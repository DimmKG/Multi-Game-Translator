import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");

async function replaceFile(path, transform) {
  const absolute = resolve(root, path);
  const before = await readFile(absolute, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(path + ": integration made no changes");
  await writeFile(absolute, after, "utf8");
}

await replaceFile("src/index.html", source => source
  .replace(
    /<select id="uiLang" class="uilang" aria-label="Interface language">[\s\S]*?<\/select>/,
    '<select id="uiLang" class="uilang" aria-label="Interface language"></select>'
  )
  .replace(
    /<script src="\.\/scripts\/i18n\/locales\.js"><\/script>\r?\n(?:<script src="\.\/scripts\/i18n\/settings-messages\.js"><\/script>\r?\n)?<script src="\.\/scripts\/i18n\/locale-bootstrap\.js"><\/script>/,
    '<script src="./scripts/i18n/locales.js"></script>\n<script src="./scripts/i18n/built-in-locales.generated.js"></script>\n<script src="./scripts/i18n/locale-bootstrap.js"></script>'
  ));

await replaceFile("scripts/build-standalone.mjs", source => source
  .replace(
    /const \[html, css, locales, settingsMessages, localeBootstrap,/,
    "const [html, css, locales, builtInLocales, localeBootstrap,"
  )
  .replace(
    /readFile\(resolve\(source, "scripts\/i18n\/settings-messages\.js"\), "utf8"\),/,
    'readFile(resolve(source, "scripts/i18n/built-in-locales.generated.js"), "utf8"),'
  )
  .replace(
    /\$\{standaloneLocales\.trimEnd\(\)\}\\n\$\{settingsMessages\.trimEnd\(\)\}\\n\$\{localeBootstrap\.trimEnd\(\)\}/,
    '${standaloneLocales.trimEnd()}\\n${builtInLocales.trimEnd()}\\n${localeBootstrap.trimEnd()}'
  )
  .replace(
    /  \.replace\('<script src="\.\/scripts\/i18n\/settings-messages\.js"><\/script>\\n', ""\)\r?\n/,
    '  .replace(\'<script src="./scripts/i18n/built-in-locales.generated.js"></script>\\n\', "")\n'
  ));

await replaceFile("scripts/check-build.mjs", source => source
  .replace(
    /requireText\("const I18N = \{", "embedded interface locales"\);/,
    'requireText("NecesseLocales.register", "embedded generated interface locales");\nrequireText("GENERATED FILE — DO NOT EDIT", "generated locale bundle marker");'
  ));

await replaceFile("src/scripts/i18n/locale-packages.js", source => source
  .replace(
    'const BUILTIN_CODES = new Set(["en", "bg", "ru"]);',
    'const isBuiltInCode = code => Boolean(globalThis.NecesseLocales?.isBuiltIn(code));'
  )
  .replace(
    'if (BUILTIN_CODES.has(input.code)) throw new TypeError(`Built-in locale “${input.code}” cannot be replaced.`);',
    'if (isBuiltInCode(input.code)) throw new TypeError(`Built-in locale “${input.code}” cannot be replaced.`);'
  ));

try {
  await unlink(resolve(root, "src/scripts/i18n/settings-messages.js"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

console.log("Integrated generated JSON locale assets into the browser and standalone runtime.");
