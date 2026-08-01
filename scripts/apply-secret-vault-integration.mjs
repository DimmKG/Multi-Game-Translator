import { readFile, writeFile } from "node:fs/promises";

async function replace(path, from, to) {
  const text = await readFile(path, "utf8");
  if (!text.includes(from)) throw new Error(`Expected text not found in ${path}`);
  await writeFile(path, text.replace(from, to), "utf8");
}

const settingsPath = "src/scripts/mt/provider-settings.js";
let settings = await readFile(settingsPath, "utf8");
settings = settings.replace(
  '  function setSecret(providerId, fieldId, value) {\n',
  '  function notifySecretsChanged() {\n    globalThis.dispatchEvent?.(new CustomEvent("necesse:mt-secrets-changed"));\n  }\n\n  function setSecret(providerId, fieldId, value) {\n'
);
settings = settings.replace(
  '    if (text) bucket.set(field.id, text);\n    else bucket.delete(field.id);\n  }',
  '    if (text) bucket.set(field.id, text);\n    else bucket.delete(field.id);\n    notifySecretsChanged();\n  }'
);
settings = settings.replace(
  '  function clearSecrets(providerId) {\n    if (providerId === undefined) secrets.clear();\n    else secrets.delete(String(providerId || ""));\n  }',
  '  function clearSecrets(providerId) {\n    if (providerId === undefined) secrets.clear();\n    else secrets.delete(String(providerId || ""));\n    notifySecretsChanged();\n  }\n\n  function exportSecrets() {\n    const result = {};\n    for (const [providerId, bucket] of secrets) {\n      const fields = {};\n      for (const [fieldId, value] of bucket) if (value) fields[fieldId] = value;\n      if (Object.keys(fields).length) result[providerId] = fields;\n    }\n    return result;\n  }\n\n  function importSecrets(snapshot, options = {}) {\n    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {\n      throw new TypeError("Provider secret snapshot must be an object.");\n    }\n    if (options.replace !== false) secrets.clear();\n    for (const [providerId, fields] of Object.entries(snapshot)) {\n      if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;\n      for (const [fieldId, value] of Object.entries(fields)) {\n        const field = fieldDefinition(providerId, fieldId);\n        if (!field || field.type !== "secret") continue;\n        const text = String(value ?? "");\n        if (text) secretBucket(providerId, true).set(field.id, text);\n      }\n    }\n    notifySecretsChanged();\n    return exportSecrets();\n  }\n\n  function secretCount() {\n    let count = 0;\n    for (const bucket of secrets.values()) count += bucket.size;\n    return count;\n  }'
);
settings = settings.replace(
  '    clearSecrets,\n    resolve,\n    exportPublic,',
  '    clearSecrets,\n    exportSecrets,\n    importSecrets,\n    secretCount,\n    resolve,\n    exportPublic,'
);
await writeFile(settingsPath, settings, "utf8");

await replace(
  "src/index.html",
  '<script src="./scripts/mt/provider-settings.js"></script>',
  '<script src="./scripts/mt/provider-settings.js"></script>\n<script src="./scripts/mt/secret-vault.js"></script>'
);
await replace(
  "src/index.html",
  '<script src="./scripts/mt/provider-settings-ui.js"></script>',
  '<script src="./scripts/mt/provider-settings-ui.js"></script>\n<script src="./scripts/mt/secret-vault-ui.js"></script>'
);

const buildPath = "scripts/build-standalone.mjs";
let build = await readFile(buildPath, "utf8");
build = build.replace(
  "const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providerSettings, providers, app, settings, providerSettingsUi, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all([",
  "const [html, css, locales, builtInLocales, localeBootstrap, localePackages, providerSettings, secretVault, providers, app, settings, providerSettingsUi, secretVaultUi, targetLanguage, glossaryLoader, glossaryManager, glossaryMatcher, glossaryQa, glossaryReview, glossaryNavigation] = await Promise.all(["
);
build = build.replace(
  '  readFile(resolve(source, "scripts/mt/provider-settings.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/mt/provider-settings.js"), "utf8"),\n  readFile(resolve(source, "scripts/mt/secret-vault.js"), "utf8"),'
);
build = build.replace(
  '  readFile(resolve(source, "scripts/mt/provider-settings-ui.js"), "utf8"),',
  '  readFile(resolve(source, "scripts/mt/provider-settings-ui.js"), "utf8"),\n  readFile(resolve(source, "scripts/mt/secret-vault-ui.js"), "utf8"),'
);
build = build.replace(
  '${localeBootstrap.trimEnd()}\\n${providerSettings.trimEnd()}\\n${providers.trimEnd()}`',
  '${localeBootstrap.trimEnd()}\\n${providerSettings.trimEnd()}\\n${secretVault.trimEnd()}\\n${providers.trimEnd()}`'
);
build = build.replace(
  '.replace(\'<script src="./scripts/mt/provider-settings.js"></script>\\n\', "")',
  '.replace(\'<script src="./scripts/mt/provider-settings.js"></script>\\n\', "")\n  .replace(\'<script src="./scripts/mt/secret-vault.js"></script>\\n\', "")'
);
build = build.replace(
  '.replace(\'<script src="./scripts/mt/provider-settings-ui.js"></script>\', `<script>${providerSettingsUi}</script>`)',
  '.replace(\'<script src="./scripts/mt/provider-settings-ui.js"></script>\', `<script>${providerSettingsUi}</script>`)\n  .replace(\'<script src="./scripts/mt/secret-vault-ui.js"></script>\', `<script>${secretVaultUi}</script>`)'
);
await writeFile(buildPath, build, "utf8");

const uiPath = "src/scripts/mt/secret-vault-ui.js";
let ui = await readFile(uiPath, "utf8");
ui = ui.replace(
  '  const t = key => globalThis.NecesseI18n?.t(key) || key;',
  `  const fallback = Object.freeze({\n    "settings.secretVaultTitle": "Encrypted provider secrets",\n    "settings.secretVaultHint": "Secrets stay in memory unless you export this password-protected file. The password is never saved.",\n    "settings.secretVaultEmpty": "No provider secrets are currently unlocked.",\n    "settings.secretVaultUnlocked": "{n} provider secret(s) are currently unlocked.",\n    "settings.secretVaultExport": "Export encrypted secrets",\n    "settings.secretVaultImport": "Import encrypted secrets",\n    "settings.secretVaultClear": "Lock and clear secrets",\n    "settings.secretVaultCreatePassword": "Create a password for the encrypted file",\n    "settings.secretVaultEnterPassword": "Enter the encrypted file password",\n    "settings.secretVaultPassword": "Password",\n    "settings.secretVaultConfirmPassword": "Confirm password",\n    "settings.secretVaultPasswordMismatch": "The passwords do not match.",\n    "settings.secretVaultCancel": "Cancel",\n    "settings.secretVaultContinue": "Continue",\n    "settings.secretVaultExportError": "Could not export encrypted secrets.",\n    "settings.secretVaultImportError": "Could not import encrypted secrets."\n  });\n  const t = key => {\n    const translated = globalThis.NecesseI18n?.t(key);\n    return translated && translated !== key ? translated : (fallback[key] || key);\n  };`
);
await writeFile(uiPath, ui, "utf8");

const testPath = "test/mt-provider-settings.test.mjs";
let tests = await readFile(testPath, "utf8");
tests += `\nconst vaultUi = await readFile(new URL("../src/scripts/mt/secret-vault-ui.js", import.meta.url), "utf8");\n\ntest("provider secret snapshots stay separate from public persistence", () => {\n  assert.match(source, /function exportSecrets\\(\\)/);\n  assert.match(source, /function importSecrets\\(snapshot/);\n  assert.match(source, /function secretCount\\(\\)/);\n  assert.doesNotMatch(source, /JSON\\.stringify\\(exportSecrets\\(\\)\\)/);\n});\n\ntest("encrypted vault controls use the vault API and never persist passwords", () => {\n  assert.match(vaultUi, /vault\\.encrypt\\(store\\.exportSecrets\\(\\), passphrase\\)/);\n  assert.match(vaultUi, /vault\\.decrypt\\(await file\\.text\\(\\), passphrase\\)/);\n  assert.match(vaultUi, /store\\.importSecrets\\(secrets, \\{ replace: true \\}\\)/);\n  assert.doesNotMatch(vaultUi, /localStorage|document\\.cookie|sessionStorage/);\n});\n`;
await writeFile(testPath, tests, "utf8");

console.log("Applied encrypted provider secret integration.");
