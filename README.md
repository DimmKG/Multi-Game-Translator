# Necesse .lang Translator

A browser-based editor for Necesse `.lang` translation files.

Use the hosted application:

**https://actepukc.github.io/Necesse-Lang-Translator/**

The application runs locally in the browser. Translation files are not uploaded to an application server.

## Current release line

`0.9.0-pre-react.1` is the stable HTML/JavaScript baseline prepared before the React and TypeScript migration.

The migration must preserve validated behaviour before adding new features. See the [React migration contract](docs/react-migration-contract.md) and [pre-React release notes](docs/pre-react-release.md).

## Origin and credits

The project began with a minimal standalone HTML editor created by **DimmKG** and shared in the Necesse Discord community on 30 July 2026 in response to a request for a translation-focused alternative to a plain text editor.

The original baseline is preserved in `legacy/necesse-lang-translator.original.html`. The current application expands it with modular source files, translation QA, review and comparison workflows, interface localization, machine-translation providers, recovery, automated validation, an offline build and a hosted web application.

## Main features

### Translation workspace

- open and edit Necesse `.lang` files locally;
- preserve sections, key order, comments, blank lines and status prefixes;
- show localization keys separately from editable values;
- detect missing, translated and reference-equal entries;
- search translations and navigate sections;
- use focused Editor, Review and Compare views;
- enter a Compact workspace with a contextual icon rail, drawers and file actions;
- preserve the active view, filters, search and edits while changing layouts.

### QA and review

- compare against a separately loaded English reference file;
- validate placeholders, item references, formatting codes and literal `\n` tokens;
- detect whitespace anomalies;
- load local or hosted terminology glossaries;
- detect preferred, alternative and forbidden terminology;
- filter terminology and whitespace issues;
- review translated entries and detected problems;
- compare two localization files with word or character-level inline differences.

### Progress and recovery

- save and load portable progress files;
- automatically preserve unfinished sessions in browser storage;
- dismiss stale recovery offers when opening another workspace;
- export deterministic `.lang` output without rewriting untouched translation text;
- keep hosted and standalone workspace behaviour aligned.

### Translation assistance

- select a machine-translation provider and explicit target language;
- keep interface language, translation target, reference language and MT target separate;
- use spelling and autocomplete controls;
- use provider settings without silently defaulting to Russian, English or the first option;
- store secrets in memory by default;
- optionally import and export an encrypted credential vault;
- keep passwords and decrypted credentials out of normal project exports.

### Interface and accessibility

- use 29 built-in interface locales with English fallback;
- preserve reviewed English, Bulgarian and Russian locale files as hand-edited sources;
- install partial external interface-locale packages;
- support right-to-left layout with logical CSS;
- keep filenames, keys and technical values left-to-right;
- configure separate interface and editor font families without uploading font files;
- use localized settings, glossary, review, compare and Compact workspace controls;
- support narrow screens and keyboard-based drawer/focus behaviour.

## Translation-file safety

The editor separates each localization key from its translated value. During normal editing, translators change only the text after `=`, while the key is displayed separately and is not part of the editable field.

Protected structures are checked before export, including:

```text
<variable>
[item/input=...]
§formatting
\n
```

The application does not normalize, regenerate or “correct” translation text automatically. Untouched values must remain byte-for-byte equivalent after parsing and serialization except for the file's preserved line-ending format.

## Hosted and standalone editions

### Hosted application

The GitHub Pages edition can load browser-accessible catalogs and public resources such as hosted glossaries.

### Standalone application

Run:

```powershell
npm run build
```

The generated file is:

```text
dist/necesse-lang-translator.html
```

It can be opened directly through `file://` without a web server. Local file import, progress files, installable interface locales and local glossaries remain available. Online catalog controls that cannot work reliably from direct-file pages are hidden.

## Run locally

Requirements: Node.js 18 or newer.

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:4173
```

To preview the generated application and production paths:

```powershell
npm run preview
```

No third-party runtime packages are required by the current HTML application.

## Verification

Run the complete test, validation and build pipeline:

```powershell
npm run verify
```

This runs the project tests, built-in locale validation, installable-locale validation, glossary validation, standalone build and standalone integrity check. GitHub Actions runs the same read-only verification for pushes and pull requests.

Individual commands include:

```powershell
npm test
npm run validate:locales
npm run validate:interface-locales
npm run validate:glossaries
npm run build
npm run check
```

## Glossaries and terminology QA

Glossaries define preferred terminology, grammatical forms, acceptable alternatives and forbidden wording without hard-coding a target language into the application.

Start here:

- [Glossary authoring and publishing guide](docs/glossaries.md)
- [Bulgarian example glossary](glossaries/examples/bg.example.json)
- [Glossary schema](schemas/glossary-v1.schema.json)
- [Catalog schema](schemas/glossary-catalog-v1.schema.json)

## Interface localization

Separate JSON files under `src/scripts/i18n/locales/` are the only hand-edited source for built-in interface translations. English is canonical and complete. Missing keys in provisional or installed locales fall back to English.

Start here:

- [Interface locale package guide](docs/interface-locales.md)
- [Partial Esperanto example](interface-locales/examples/eo.partial.example.json)
- [Interface locale schema](schemas/interface-locale-v1.schema.json)

## Project structure

- `src/index.html` — interface markup
- `src/styles/app.css` — application styles
- `src/scripts/app.js` — current editor orchestration and domain behaviour
- `src/scripts/i18n/` — built-in and installable interface localization
- `src/scripts/glossary/` — glossary loading, terminology QA and navigation
- `src/scripts/mt/` — machine-translation provider integration
- `src/glossaries/` — public glossary catalog and browser-accessible glossary files
- `schemas/` — JSON schemas
- `docs/` — authoring, release and migration documentation
- `test/` — behavioural and regression tests
- `scripts/` — validators, development server and build tools
- `legacy/necesse-lang-translator.original.html` — preserved original baseline
- `dist/necesse-lang-translator.html` — generated standalone build

## Migration status

The current HTML/JavaScript application is feature-complete for the pre-React baseline. React and TypeScript work must target parity first and must not silently change parsing, export, recovery, localization fallback, provider rules, encrypted-vault behaviour, responsive layout or RTL behaviour.

See:

- [React migration contract](docs/react-migration-contract.md)
- [Pre-React release notes and freeze procedure](docs/pre-react-release.md)
- [Changelog](CHANGELOG.md)

## Feedback

Reports about real translation workflows, file round trips, terminology checks, accessibility, language-specific behaviour and narrow-screen layouts are welcome. Open a GitHub issue with a clear description and, where useful, a screenshot or a small reproducible sample.
