# Interface locale packages

Interface locale packages add languages to the editor without modifying the application source.

They use the same shared i18n message keys as the built-in interface languages. A package may translate the complete application or only selected messages; every missing message falls back to English.

## Quick start

Open **Interface languages** and choose **Export English template**. The downloaded file contains every currently supported message key.

Change the package metadata, translate the values and import the JSON through **Interface languages → Import locale**.

A small partial package looks like this:

```json
{
  "$schema": "../../schemas/interface-locale-v1.schema.json",
  "format": "necesse-interface-locale",
  "version": 1,
  "code": "es",
  "name": "Spanish",
  "nativeName": "Español",
  "authors": ["Translator name"],
  "updatedAt": "2026-08-01",
  "messages": {
    "app.title": "Necesse — traductor de .lang",
    "tab.editor": "Editor",
    "tab.review": "Revisión",
    "glossary.button": "Glosarios"
  }
}
```

## Package metadata

| Field | Meaning |
| --- | --- |
| `format` | Must be `necesse-interface-locale`. |
| `version` | Package format version. Currently `1`. |
| `code` | Language tag such as `es`, `de`, `pt-BR` or `es-419`. |
| `name` | Language name in English or another broadly readable form. |
| `nativeName` | Name displayed in the interface selector. |
| `messages` | Object containing translated i18n message values. |
| `authors` | Optional contributor names. |
| `updatedAt` | Optional update date in `YYYY-MM-DD` format. |

The built-in `en`, `bg` and `ru` language codes are protected and cannot be replaced by imported packages.

## Message keys and values

Translate values only. Do not rename message keys.

Correct:

```json
"filter.missing": "Sin traducir"
```

Incorrect:

```json
"filtro.sinTraducir": "Sin traducir"
```

Unknown keys are rejected during import and repository validation. This prevents misspelled keys from silently creating translations that the application never uses.

## Partial packages and English fallback

Packages do not need to be complete.

For example:

```json
{
  "messages": {
    "tab.editor": "Editor",
    "tab.review": "Revisión"
  }
}
```

All other messages use the built-in English text. This allows a language to be tested and expanded gradually without displaying empty interface elements.

Fallback applies to the complete current interface, including:

- the main editor;
- Review and Compare views;
- Glossary Manager;
- terminology warnings and navigation;
- Interface Languages Manager;
- glossary update and status messages.

## Placeholders

Preserve placeholders exactly. They are replaced at runtime.

Examples:

```json
"save.savedAt": "saved {time} · {n} done"
"terminology.reviewBadge": "Terminology: {n}"
"interfaceLocales.loaded": "Interface language “{name}” was installed."
```

A translation may move placeholders to a grammatically appropriate position, but must not rename or remove them unless the translated message genuinely does not need the information.

Correct:

```json
"interfaceLocales.loaded": "Se instaló el idioma «{name}»."
```

Incorrect:

```json
"interfaceLocales.loaded": "Se instaló el idioma «{languageName}»."
```

The application currently uses simple `{name}` replacement rather than ICU MessageFormat.

## HTML-bearing messages

Some keys are inserted as trusted application HTML, for example explanatory text containing `<br>` or escaped markup examples.

When translating an exported template:

- preserve required tags such as `<br>`;
- preserve escaped examples such as `&lt;variable&gt;`;
- do not add scripts, event handlers or external embeds;
- treat message values as interface copy, not arbitrary webpage content.

## Plural message pairs

Some labels use separate `.one` and `.other` keys:

```json
"terminology.count.one": "{n} terminology issue",
"terminology.count.other": "{n} terminology issues"
```

Version 1 currently chooses `.one` only when the number is exactly `1`; every other number uses `.other`.

Languages requiring additional plural categories cannot express all native plural rules in version 1. They should use wording that remains acceptable under the available two-form behaviour.

## Import, replacement and persistence

Use **Interface languages** next to the interface language selector, then choose **Import locale**.

Importing a package:

- validates its metadata and message keys;
- adds its `nativeName` to the interface selector;
- stores the package in browser `localStorage`;
- restores it on future visits before the saved interface language is selected.

Importing the same `code` again replaces the installed package. This is the update mechanism for locally distributed interface translations.

Removing a package deletes it from browser storage. If that language is currently selected, the interface returns to English.

Installed packages belong to the current browser profile and site origin. A package imported into a local development address is not automatically shared with GitHub Pages, another browser or the standalone `file://` version.

## Document language

When the interface language changes, the application also updates the document's HTML language tag:

```js
document.documentElement.lang = UI;
```

This helps browser translation prompts, accessibility tools and spellchecking identify the actual interface language.

Use a valid language tag in `code`, including regional forms where appropriate:

```text
pt-BR
zh-CN
es-419
```

## Creating a complete package

1. Open **Interface languages**.
2. Export the English template.
3. Change `code`, `name`, `nativeName`, `authors` and `updatedAt`.
4. Translate message values without changing keys.
5. Preserve placeholders and required markup.
6. Import the package and inspect every major view.
7. Run repository validation before contributing it.

The exported template is preferable to copying an older package because it always reflects the message keys supported by the current application version.

## Testing checklist

Test at least:

- the empty file-selection screen;
- the Editor filters and toolbar;
- `en.lang` reference loading;
- Review and Compare tabs;
- Glossary Manager with local and online glossaries;
- terminology warning cards and navigation;
- Interface Languages Manager itself;
- messages containing `{n}`, `{name}`, `{file}` or `{time}`;
- narrow labels that may overflow buttons or dialogs.

A partial package is valid, so untranslated English text is not itself an error. Incorrect placeholders, misleading labels and broken markup are errors.

## Repository validation

Run interface locale validation separately:

```powershell
npm run validate:interface-locales
```

Or run all checks and rebuild the standalone file:

```powershell
npm run verify
```

The validator checks:

- package metadata;
- supported language-tag syntax;
- protected built-in language codes;
- message value types;
- every message key against the built-in English locale;
- example packages stored in the repository.

The normative schema is:

```text
schemas/interface-locale-v1.schema.json
```

A partial Spanish example is available at:

```text
interface-locales/examples/es.partial.example.json
```

## Built-in languages and installable packages

The application currently keeps its built-in interface translations in `src/scripts/i18n/locales.js`. Installable packages use JSON and are layered over the same English message key set.

The two systems now cover the same interface, but the storage format is not yet unified: built-in languages are source-controlled JavaScript data, while additional languages are installable JSON packages.

Moving built-in translations into separate validated JSON files is a future refactor. It is not required for creating or using an installable locale package.
