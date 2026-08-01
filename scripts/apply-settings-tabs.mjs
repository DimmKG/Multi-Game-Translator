import { readFile, writeFile } from "node:fs/promises";

async function replace(path, from, to) {
  const text = await readFile(path, "utf8");
  if (!text.includes(from)) throw new Error(`Expected text not found in ${path}`);
  await writeFile(path, text.replace(from, to), "utf8");
}

const tabsPath = "src/scripts/settings-tabs.js";
let tabs = await readFile(tabsPath, "utf8");
tabs = tabs.replace(
  '        if (!(node instanceof Element) || node === ui.tablist || node === ui.panels) continue;\n        if (node.closest?.(".settings-tabs-shell")) continue;',
  '        if (!(node instanceof Element) || node === ui.tablist || node === ui.panels) continue;\n        if (node.parentElement?.classList.contains("settings-tab-panel")) continue;'
);
tabs = tabs.replace(
  '    ui.panels = document.createElement("div");\n    ui.panels.className = "settings-tab-panels";\n    ui.shell.append(ui.tablist, ui.panels);\n    list.replaceWith(ui.shell);',
  '    ui.panels = list;\n    ui.panels.classList.add("settings-tab-panels");\n    list.replaceWith(ui.shell);\n    ui.shell.append(ui.tablist, list);'
);
await writeFile(tabsPath, tabs, "utf8");

await replace(
  "src/index.html",
  '<script src="./scripts/mt/secret-vault-ui.js"></script>',
  '<script src="./scripts/mt/secret-vault-ui.js"></script>\n<script src="./scripts/settings-tabs.js"></script>'
);

const buildPath = "scripts/build-standalone.mjs";
let build = await readFile(buildPath, "utf8");
build = build.replace(
  "const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providerSettings, secretVault, providers, app, settings, fontSettings, providerSettingsUi, secretVaultUi, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([",
  "const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providerSettings, secretVault, providers, app, settings, fontSettings, providerSettingsUi, secretVaultUi, settingsTabs, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all(["
);
build = build.replace(
  '  readFile(resolve(source, "scripts/mt/secret-vault-ui.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/mt/secret-vault-ui.js"), "utf8"),\n  readFile(resolve(source, "scripts/settings-tabs.js"), "utf8"),'
);
build = build.replace(
  '.replace(\'<script src="./scripts/mt/secret-vault-ui.js"></script>\', `<script>${secretVaultUi}</script>`)',
  '.replace(\'<script src="./scripts/mt/secret-vault-ui.js"></script>\', `<script>${secretVaultUi}</script>`)\n  .replace(\'<script src="./scripts/settings-tabs.js"></script>\', `<script>${settingsTabs}</script>`)'
);
await writeFile(buildPath, build, "utf8");

const roadmapPath = "docs/mt-roadmap.md";
let roadmap = await readFile(roadmapPath, "utf8");
roadmap = roadmap.replace(
  "Google remains the only registered provider. The next work is to add provider configuration and additional conventional translation services without introducing AI-prompt complexity yet.",
  "Google remains the only registered provider. The provider configuration foundation, encrypted secret vault and configurable font preferences are complete. The current sequence is issue #35 (Settings tabs), issue #27 (reference/provider wording and locale pass), Stage 3B (LibreTranslate-compatible provider), then Stage 3C (DeepL)."
);
roadmap = roadmap.replace(
  "### Stage 3A: provider configuration foundation\n\nGoal: provide a safe shared place for provider-specific settings before adding providers that require configuration.\n\nPlanned changes:",
  "### Stage 3A: provider configuration foundation\n\nCompleted through PR #32, followed by the encrypted secret vault in PR #33 and configurable font preferences in PR #34.\n\nImplemented:"
);
roadmap = roadmap.replace(
  "- [ ] Stage 3A — provider configuration foundation\n- [ ] Issue #27 — reference-file wording and locale pass",
  "- [x] Stage 3A — provider configuration foundation ([PR #32](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/32))\n- [x] Encrypted provider-secret vault ([PR #33](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/33))\n- [x] Configurable font preferences ([PR #34](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/34))\n- [ ] Issue #35 — Settings tabs and responsive dialog\n- [ ] Issue #27 — reference-file wording and locale pass"
);
await writeFile(roadmapPath, roadmap, "utf8");

await writeFile("test/settings-tabs.test.mjs", `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst source = await readFile(new URL("../src/scripts/settings-tabs.js", import.meta.url), "utf8");\nconst html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");\nconst build = await readFile(new URL("../scripts/build-standalone.mjs", import.meta.url), "utf8");\n\ntest("Settings tabs expose an accessible registration API", () => {\n  assert.match(source, /function register\\(id, element/);\n  assert.match(source, /role\\", \\"tablist/);\n  assert.match(source, /role\\", \\"tab/);\n  assert.match(source, /role\\", \\"tabpanel/);\n  assert.match(source, /ArrowRight|ArrowLeft/);\n});\n\ntest("Settings tabs remember the active tab and remain scrollable", () => {\n  assert.match(source, /necesse-translator\\.settings-tab\\.v1/);\n  assert.match(source, /max-height:min\\(760px/);\n  assert.match(source, /overflow:auto/);\n});\n\ntest("existing Settings modules remain compatible with settings-list", () => {\n  assert.match(source, /ui\\.panels = list/);\n  assert.match(source, /MutationObserver/);\n  assert.match(source, /font-settings-section/);\n  assert.match(source, /settings-vault-section/);\n  assert.match(source, /settings-provider-section/);\n});\n\ntest("hosted and standalone builds load Settings tabs", () => {\n  assert.match(html, /settings-tabs\\.js/);\n  assert.match(build, /settingsTabs/);\n});\n`);

console.log("Applied Settings tabs integration and roadmap tracking.");
