# Interface localization

Built-in interface messages live in `src/scripts/i18n/locales.js`. English is the required fallback locale.

## Adding a built-in locale

1. Copy an existing locale object.
2. Use a valid language code as its key.
3. Translate values only. Do not rename message keys.
4. Preserve placeholders such as `{n}`, `{name}` and `{file}`.
5. Run `npm run validate:locales`.

The validator requires every locale to contain exactly the English key set and the same placeholders for each message.

The standalone build embeds all built-in locales into one HTML file, so direct offline use remains supported. A future locale-pack importer will allow additional languages to be loaded locally without rebuilding the application.
