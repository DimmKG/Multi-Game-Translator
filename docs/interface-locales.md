# Interface locale packages

Interface locale packages add languages to the editor without modifying the application source.

## Package format

A package is a JSON document using format version 1:

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
    "tab.editor": "Editor"
  }
}
```

Packages may be partial. Every missing message falls back to the built-in English locale. Unknown message keys are rejected so spelling mistakes cannot silently create unused translations.

The built-in `en`, `bg` and `ru` language codes are protected and cannot be replaced by imported packages.

## Import and persistence

Use **Interface languages** next to the interface language selector, then choose **Import locale**. Importing the same language code again replaces the installed package. Installed packages are stored in the browser and restored before the application selects its saved interface language.

Removing a package deletes it from browser storage. If that package is currently selected, the interface returns to English.

## Exporting a template

The manager can export a complete English template containing every supported core-interface message key. Change its metadata and translate any or all message values.

## Validation

Run:

```powershell
npm run validate:interface-locales
```

The validator checks package metadata, protected language codes, message value types and every message key against the built-in English locale.

## Current scope

Version 1 packages translate the core editor interface represented by `src/scripts/i18n/locales.js`. Some later extension panels, including glossary and terminology controls, still have their own built-in EN/BG/RU text tables and therefore use English when an imported language is selected. Moving those extension strings into the shared interface locale system is a separate compatibility step.
