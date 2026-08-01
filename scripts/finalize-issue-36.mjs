import { readFile, writeFile, rm } from "node:fs/promises";

const read = path => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");

const indexPath = "src/index.html";
let index = await read(indexPath);
if (!index.includes('./scripts/new-translation.js')) {
  index = index.replace(
    '<script src="./scripts/app.js"></script>\n',
    '<script src="./scripts/app.js"></script>\n<script type="module" src="./scripts/new-translation.js"></script>\n'
  );
}
await write(indexPath, index);

const buildPath = "scripts/build-standalone.mjs";
let build = await read(buildPath);
const missingReader = '  readFile(resolve(source, "scripts/app.js"), "utf8"),\n  readFile(resolve(source, "scripts/settings.js"), "utf8"),';
const fixedReader = '  readFile(resolve(source, "scripts/app.js"), "utf8"),\n  readFile(resolve(source, "scripts/new-translation.js"), "utf8"),\n  readFile(resolve(source, "scripts/settings.js"), "utf8"),';
if (build.includes(missingReader)) build = build.replace(missingReader, fixedReader);

if (!build.includes("const bundledNewTranslation")) {
  build = build.replace(
    'const bundledLocalePackages = `{\\n${stripModuleSyntax(localePackages)}\\n}`;\n',
    'const bundledLocalePackages = `{\\n${stripModuleSyntax(localePackages)}\\n}`;\nconst bundledNewTranslation = `{\\n${stripModuleSyntax(newTranslation)}\\n}`;\n'
  );
}

if (!build.includes("newTranslationTag")) {
  build = build.replace(
    'const localePackageTag = /<script\\b(?=[^>]*\\btype=["\']module["\'])(?=[^>]*\\bsrc=["\']\\.\\/scripts\\/i18n\\/locale-packages\\.js["\'])[^>]*><\\/script>/i;\n',
    'const newTranslationTag = /<script\\b(?=[^>]*\\btype=["\']module["\'])(?=[^>]*\\bsrc=["\']\\.\\/scripts\\/new-translation\\.js["\'])[^>]*><\\/script>/i;\nconst localePackageTag = /<script\\b(?=[^>]*\\btype=["\']module["\'])(?=[^>]*\\bsrc=["\']\\.\\/scripts\\/i18n\\/locale-packages\\.js["\'])[^>]*><\\/script>/i;\n'
  );
}

if (!build.includes('.replace(newTranslationTag')) {
  build = build.replace(
    '  .replace(\'<script src="./scripts/app.js"></script>\', `<script>${combinedApp}</script>`)\n',
    '  .replace(\'<script src="./scripts/app.js"></script>\', `<script>${combinedApp}</script>`)\n  .replace(newTranslationTag, `<script>${bundledNewTranslation}</script>`)\n'
  );
}
await write(buildPath, build);

const validate = `name: Validate project

on:
  push:
    branches:
      - main
      - "agent/**"
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Verify standalone build
        run: npm run verify
`;
await write(".github/workflows/validate.yml", validate);

for (const path of [
  ".github/workflows/apply-new-translation-from-reference.yml",
  ".github/workflows/issue-36-apply.yml",
  "scripts/apply-issue-36.mjs",
  "scripts/apply-new-translation-from-reference.mjs",
  "scripts/finalize-issue-36.mjs"
]) {
  await rm(path, { force: true });
}

console.log("Issue 36 source integration finalized.");
