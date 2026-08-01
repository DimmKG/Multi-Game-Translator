# Necesse .lang Translator

A browser-based editor for Necesse `.lang` translation files.

It supports local editing, English reference files, review and comparison views, terminology glossaries, installable interface translations and a generated standalone HTML build.

## Project structure

- `src/index.html` — interface markup
- `src/styles/app.css` — application styles
- `src/scripts/app.js` — core editor logic
- `src/scripts/i18n/` — built-in and installable interface localization support
- `src/scripts/glossary/` — glossary loading, terminology QA and navigation
- `src/glossaries/` — public online catalog and browser-accessible glossary files
- `schemas/` — normative JSON schemas
- `docs/` — authoring and usage guides
- `legacy/necesse-lang-translator.original.html` — preserved original baseline
- `dist/necesse-lang-translator.html` — generated standalone build

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

Build and serve the generated standalone version:

```powershell
npm run preview
```

No third-party packages are required for either command.

## Standalone build

Build the single-file offline application:

```powershell
npm run build
```

The generated file is written to:

```text
dist/necesse-lang-translator.html
```

The standalone file can be opened directly through `file://`. Local glossary import and installable interface locale import remain available, while online catalog controls are hidden because browsers do not permit the same HTTP loading behaviour in direct-file mode.

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

An installable package may be partial. Missing keys automatically use English, and importing the same language code again replaces the stored package.

Start here:

- [Interface locale package guide](docs/interface-locales.md)
- [Partial Spanish example](interface-locales/examples/es.partial.example.json)
- [Interface locale schema](schemas/interface-locale-v1.schema.json)

The shared i18n system covers the core editor, glossary management, terminology warnings and navigation, Review terminology badges and the interface-language manager.

## Current status

The main functional milestone is complete:

- modular source and generated standalone build;
- GitHub Pages-compatible public application tree;
- built-in and installable interface localization;
- local and online glossaries;
- terminology QA, filtering and Review integration;
- glossary version tracking and explicit updates;
- automated validation and regression tests.

Remaining work is primarily documentation refinement and interface polishing, including settings, optional navigation-panel collapsing and improved narrow-screen behaviour.
