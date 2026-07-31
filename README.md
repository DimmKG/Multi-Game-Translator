# Necesse .lang Translator

A browser-based editor for Necesse `.lang` translation files.

## Current baseline

The project begins by preserving the behaviour of the original standalone HTML while separating the source into maintainable files:

- `src/index.html` - interface markup
- `src/styles/app.css` - application styles
- `src/scripts/app.js` - current application logic
- `legacy/necesse-lang-translator.original.html` - untouched original baseline
- `dist/necesse-lang-translator.html` - generated standalone build

## Build and verification

Requirements: Node.js 18 or newer.

Build the standalone application:

```powershell
npm run build
```

Build it and verify that it still matches the preserved original baseline:

```powershell
npm run verify
```

The generated standalone application is written to:

```text
dist/necesse-lang-translator.html
```

GitHub Actions runs the same verification automatically for pushes and pull requests.

## Development direction

The first milestone is structural only. Existing behaviour and technical guidance must be preserved while the code is separated into modules.

Planned follow-up work:

1. Convert Russian-only technical comments and mixed-language instructions to unified English without removing their meaning.
2. Extract interface localization into validated external locale packs.
3. Add local and online glossary loading through a versioned JSON format and catalog.
4. Introduce project storage, source update tracking, terminology QA and additional review states.
5. Publish the web build through GitHub Pages while continuing to generate a standalone HTML file.
