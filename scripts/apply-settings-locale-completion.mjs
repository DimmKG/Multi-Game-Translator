import { readFile, writeFile } from "node:fs/promises";

const updates = {
  en: {
    "settings.tab.general": "General",
    "settings.tab.fonts": "Fonts",
    "settings.tab.machine-translation": "Machine Translation",
    "settings.tab.secrets": "Secrets",
    "settings.font.title": "Fonts",
    "settings.font.hint": "Choose separate fonts for the interface and translation editor. Only the font-family preference is stored.",
    "settings.font.interface": "Interface font",
    "settings.font.editor": "Editor font",
    "settings.font.custom": "Custom local font name",
    "settings.font.preview": "Preview: Български · English · Русский · العربية · 日本語 · 한국어 · 中文",
    "settings.font.default": "Default",
    "settings.font.system": "System sans-serif",
    "settings.font.serif": "Serif",
    "settings.font.mono": "Monospace",
    "settings.secretVaultTitle": "Encrypted provider secrets",
    "settings.secretVaultHint": "Secrets stay in memory unless you export this password-protected file. The password is never saved.",
    "settings.secretVaultEmpty": "No provider secrets are currently unlocked.",
    "settings.secretVaultUnlocked": "Unlocked provider secrets: {n}.",
    "settings.secretVaultExport": "Export encrypted secrets",
    "settings.secretVaultImport": "Import encrypted secrets",
    "settings.secretVaultClear": "Lock and clear secrets",
    "settings.secretVaultCreatePassword": "Create a password for the encrypted file",
    "settings.secretVaultEnterPassword": "Enter the encrypted file password",
    "settings.secretVaultPassword": "Password",
    "settings.secretVaultConfirmPassword": "Confirm password",
    "settings.secretVaultPasswordMismatch": "The passwords do not match.",
    "settings.secretVaultCancel": "Cancel",
    "settings.secretVaultContinue": "Continue",
    "settings.secretVaultExportError": "Could not export encrypted secrets.",
    "settings.secretVaultImportError": "Could not import encrypted secrets.",
    "footnote.same": " · same as reference: {n}"
  },
  bg: {
    "settings.tab.general": "Общи",
    "settings.tab.fonts": "Шрифтове",
    "settings.tab.machine-translation": "Машинен превод",
    "settings.tab.secrets": "Тайни данни",
    "settings.font.title": "Шрифтове",
    "settings.font.hint": "Изберете отделни шрифтове за интерфейса и редактора на превода. Запазва се само предпочитанието за font-family.",
    "settings.font.interface": "Шрифт на интерфейса",
    "settings.font.editor": "Шрифт на редактора",
    "settings.font.custom": "Име на локален шрифт",
    "settings.font.preview": "Преглед: Български · English · Русский · العربية · 日本語 · 한국어 · 中文",
    "settings.font.default": "По подразбиране",
    "settings.font.system": "Системен безсерифен",
    "settings.font.serif": "Серифен",
    "settings.font.mono": "Моноширинен",
    "settings.secretVaultTitle": "Криптирани поверителни данни за доставчиците",
    "settings.secretVaultHint": "Поверителните данни остават само в паметта, освен ако не ги експортирате в защитен с парола файл. Паролата никога не се запазва.",
    "settings.secretVaultEmpty": "В момента няма отключени поверителни данни за доставчици.",
    "settings.secretVaultUnlocked": "Отключени поверителни данни за доставчици: {n}.",
    "settings.secretVaultExport": "Експортирай криптираните данни",
    "settings.secretVaultImport": "Импортирай криптирани данни",
    "settings.secretVaultClear": "Заключи и изчисти данните",
    "settings.secretVaultCreatePassword": "Създайте парола за криптирания файл",
    "settings.secretVaultEnterPassword": "Въведете паролата за криптирания файл",
    "settings.secretVaultPassword": "Парола",
    "settings.secretVaultConfirmPassword": "Потвърдете паролата",
    "settings.secretVaultPasswordMismatch": "Паролите не съвпадат.",
    "settings.secretVaultCancel": "Отказ",
    "settings.secretVaultContinue": "Продължи",
    "settings.secretVaultExportError": "Криптираните данни не можаха да бъдат експортирани.",
    "settings.secretVaultImportError": "Криптираните данни не можаха да бъдат импортирани.",
    "footnote.same": " · като референцията: {n}"
  },
  ru: {
    "settings.tab.general": "Общие",
    "settings.tab.fonts": "Шрифты",
    "settings.tab.machine-translation": "Машинный перевод",
    "settings.tab.secrets": "Секреты",
    "settings.font.title": "Шрифты",
    "settings.font.hint": "Выберите отдельные шрифты для интерфейса и редактора перевода. Сохраняется только настройка font-family.",
    "settings.font.interface": "Шрифт интерфейса",
    "settings.font.editor": "Шрифт редактора",
    "settings.font.custom": "Имя локального шрифта",
    "settings.font.preview": "Предпросмотр: Български · English · Русский · العربية · 日本語 · 한국어 · 中文",
    "settings.font.default": "По умолчанию",
    "settings.font.system": "Системный без засечек",
    "settings.font.serif": "С засечками",
    "settings.font.mono": "Моноширинный",
    "settings.secretVaultTitle": "Зашифрованные секреты провайдеров",
    "settings.secretVaultHint": "Секреты остаются только в памяти, если вы не экспортируете их в защищённый паролем файл. Пароль никогда не сохраняется.",
    "settings.secretVaultEmpty": "Сейчас нет разблокированных секретов провайдеров.",
    "settings.secretVaultUnlocked": "Разблокировано секретов провайдеров: {n}.",
    "settings.secretVaultExport": "Экспортировать зашифрованные секреты",
    "settings.secretVaultImport": "Импортировать зашифрованные секреты",
    "settings.secretVaultClear": "Заблокировать и очистить секреты",
    "settings.secretVaultCreatePassword": "Создайте пароль для зашифрованного файла",
    "settings.secretVaultEnterPassword": "Введите пароль зашифрованного файла",
    "settings.secretVaultPassword": "Пароль",
    "settings.secretVaultConfirmPassword": "Подтвердите пароль",
    "settings.secretVaultPasswordMismatch": "Пароли не совпадают.",
    "settings.secretVaultCancel": "Отмена",
    "settings.secretVaultContinue": "Продолжить",
    "settings.secretVaultExportError": "Не удалось экспортировать зашифрованные секреты.",
    "settings.secretVaultImportError": "Не удалось импортировать зашифрованные секреты.",
    "footnote.same": " · как в источнике: {n}"
  }
};

for (const [code, messages] of Object.entries(updates)) {
  const path = `src/scripts/i18n/locales/${code}.json`;
  const locale = JSON.parse(await readFile(path, "utf8"));
  Object.assign(locale.messages, messages);
  await writeFile(path, JSON.stringify(locale, null, 2) + "\n", "utf8");
}

const testPath = "test/settings-locale-completion.test.mjs";
await writeFile(testPath, `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst locales = Object.fromEntries(await Promise.all(["en", "bg", "ru"].map(async code => [code, JSON.parse(await readFile(new URL(\`../src/scripts/i18n/locales/\${code}.json\`, import.meta.url), "utf8"))])));\n\nconst requiredKeys = [\n  "settings.tab.general", "settings.tab.fonts", "settings.tab.machine-translation", "settings.tab.secrets",\n  "settings.font.title", "settings.font.hint", "settings.font.interface", "settings.font.editor",\n  "settings.secretVaultTitle", "settings.secretVaultHint", "settings.secretVaultEmpty",\n  "settings.secretVaultExport", "settings.secretVaultImport", "settings.secretVaultClear"\n];\n\ntest("reviewed locales contain Settings font and secret messages", () => {\n  for (const locale of Object.values(locales)) {\n    for (const key of requiredKeys) assert.ok(locale.messages[key], \`missing \${key} in \${locale.code}\`);\n  }\n});\n\ntest("reference footer wording is language-correct", () => {\n  assert.equal(locales.en.messages["footnote.same"], " · same as reference: {n}");\n  assert.equal(locales.bg.messages["footnote.same"], " · като референцията: {n}");\n  assert.equal(locales.ru.messages["footnote.same"], " · как в источнике: {n}");\n});\n`, "utf8");

console.log("Completed reviewed Settings localization.");
