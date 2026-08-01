# Necesse .lang Translator

A browser-based editor for Necesse `.lang` translation files.

Use the hosted application:

**https://actepukc.github.io/Necesse-Lang-Translator/**

The editor works locally in the browser and supports reference files, translation review, file comparison, terminology glossaries, interface localization and an offline standalone build.

## Origin and credits

The project began with a minimal standalone HTML editor created by **DimmKG** and shared in the Necesse Discord community on 30 July 2026 in response to a request for a translation-focused alternative to a plain text editor.

The current project preserves that original baseline in `legacy/necesse-lang-translator.original.html` and expands it with modular source files, review and comparison tools, terminology QA, interface localization, validation, automated tests, an offline build and a hosted web application.

## Features

- open and edit Necesse `.lang` files locally;
- detect missing and unchanged translations;
- compare against an English reference file;
- save and restore translation progress;
- review translated entries and detected issues;
- compare two localization files;
- load local or hosted terminology glossaries;
- detect preferred, alternative and forbidden terminology;
- preserve placeholders and formatting tokens;
- use built-in or installable interface languages;
- open the generated standalone application without a web server.

Files are processed in the browser. The application does not upload localization files to a server.

## Translation-file safety

The editor separates each localization key from its translated value. During normal editing, translators change only the text after `=`, while the key itself is displayed separately and is not part of the editable translation field.

The application also checks protected content such as placeholders, references, formatting codes and explicit newline tokens. Missing or changed tokens are shown as review warnings before export. The comparison view can be used as an additional final check against another `.lang` file.

These checks are intended to reduce accidental changes to structures such as:

```text
codeName=
<variable>
[item/input=...]
\n
```

## Run locally

The source version should be opened through the included local HTTP server rather than directly through a `file://` URL. HTTP mode enables the public glossary catalog and other external data files.

Requirements: Node.js 18 or newer.

```powershell
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

No third-party packages are required.

## Standalone build

Build the single-file offline application:

```powershell
npm run build
```

The generated file is written to:

```text
dist/necesse-lang-translator.html
```

The standalone file can be opened directly through `file://`. Local glossary import and installable interface-locale import remain available. Online catalog controls are hidden because direct-file pages cannot load the same external resources as the hosted version.

## Verification

Run all tests, validators and the standalone build check:

```powershell
npm run verify
```

GitHub Actions runs the same verification for pushes and pull requests.

Individual validation commands include:

```powershell
npm run validate:locales
npm run validate:interface-locales
npm run validate:glossaries
```

## Glossaries and terminology QA

Glossaries define preferred terminology, grammatical forms, acceptable alternatives and forbidden wording without hard-coding a specific target language into the application.

Features include:

- local JSON import;
- hosted online catalog loading;
- saved enable/disable state;
- explicit catalog update checks through `updatedAt`;
- grammatical `forms` and acceptable `alternatives`;
- forbidden terminology warnings;
- protected placeholder and formatting-token masking;
- terminology filtering, next-issue navigation and Review integration.

Start here:

- [Glossary authoring and publishing guide](docs/glossaries.md)
- [Bulgarian example glossary](glossaries/examples/bg.example.json)
- [Glossary schema](schemas/glossary-v1.schema.json)
- [Catalog schema](schemas/glossary-catalog-v1.schema.json)

## Interface localization

The editor includes built-in interface languages and also accepts installable JSON locale packages.

An installable package may be partial. Missing keys automatically use English. Importing the same non-built-in language code again replaces the stored package.

Start here:

- [Interface locale package guide](docs/interface-locales.md)
- [Partial Esperanto example](interface-locales/examples/eo.partial.example.json)
- [Interface locale schema](schemas/interface-locale-v1.schema.json)

The shared interface-localization system covers the editor, settings, glossary management, terminology warnings, review tools and the interface-language manager. Right-to-left layout is enabled for Arabic, while filenames, localization keys and other technical values remain left-to-right.

## Project structure

- `src/index.html` — interface markup
- `src/styles/app.css` — application styles
- `src/scripts/app.js` — core editor logic
- `src/scripts/i18n/` — built-in and installable interface localization
- `src/scripts/glossary/` — glossary loading, terminology QA and navigation
- `src/glossaries/` — public glossary catalog and browser-accessible glossary files
- `schemas/` — JSON schemas
- `docs/` — authoring and usage guides
- `legacy/necesse-lang-translator.original.html` — preserved original baseline
- `dist/necesse-lang-translator.html` — generated standalone build

## Feedback

Feedback from translators is welcome, especially reports about real localization workflows, language-specific behaviour, terminology checks, accessibility and narrow-screen usability. Open a GitHub issue with a clear description and, where useful, a screenshot or small reproducible sample.
