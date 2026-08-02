# Necesse .lang Translator

A browser-based editor for Necesse `.lang` translation files.

Use the hosted application:

**https://actepukc.github.io/Necesse-Lang-Translator/**

The editor works locally in the browser and supports reference files, translation review, file comparison, terminology glossaries, interface localization, theme switching and an offline preview build.

## Stack

- React + TypeScript
- Vite (bundler / dev server / preview)
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/)
- Vitest, ESLint (recommended), Prettier

## Origin and credits

The project began with a minimal standalone HTML editor created by **DimmKG** and shared in the Necesse Discord community on 30 July 2026. The original baseline is preserved in `legacy/necesse-lang-translator.original.html`.

## Features

- open and edit Necesse `.lang` files locally;
- detect missing and unchanged translations;
- compare against a reference file;
- save and restore translation progress;
- review translated entries and detected issues;
- compare two localization files (token-aware);
- load local or hosted terminology glossaries;
- detect preferred, alternative and forbidden terminology;
- preserve placeholders and formatting tokens;
- use built-in or installable interface languages;
- switch visual themes (Dungeon default, plus eight shadcn palettes in light or dark);
- work on a phone: chrome folds into one menu, and the editor keeps the card you are typing in above the on-screen keyboard;
- build a static SPA for hosting or offline preview.

Files are processed in the browser. The application does not upload localization files to a server.

## Run locally

Requirements: Node.js 18 or newer (22 recommended).

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

## Build and preview

```bash
npm run build
npm run preview
```

The SPA is written to `dist/` (`dist/` is gitignored). Preview serves the built assets locally. Online glossary catalog controls require HTTP mode.

## Verification

```bash
npm run verify
```

This runs lint, Prettier check, unit tests, locale/glossary validators and a production build.

## Themes

The default theme is the original warm dungeon/torch palette, a dark-only design of the app's own. Eight neutral palettes from [shadcn-theme-switcher](https://github.com/nimone/shadcn-theme-switcher) sit alongside it — shadcn, Modern Minimal, Graphite, Mono, Cosmic Night, Catppuccin, Perpetuity and Amethyst Haze — each with a light and a dark mode.

Both live under **Appearance** in the workspace menu (the ☰ button in the header). The theme and the mode are stored separately in `localStorage`; for a dark-only palette the mode toggle is disabled.

## Glossaries and interface locales

- [Glossary guide](docs/glossaries.md)
- [Interface locale guide](docs/interface-locales.md)
- Schemas under `schemas/`
- Built-in UI locales under `src/locales/`

## Project structure

- `src/` — React application
- `src/core/` — pure translation/diff/glossary/MT logic
- `src/components/ui/` — shadcn components
- `src/features/` — editor, review, compare, glossary, settings, i18n
- `public/glossaries/` — hosted glossary catalog assets
- `legacy/` — original baseline HTML
- `dist/` — generated SPA build (not committed)

## shadcn components

UI primitives are managed with the shadcn CLI (`components.json`). Example:

```bash
npx shadcn@latest add button
```

## License

Copyright (C) 2026 Shteryan Nikolaev, Dmitrii Petrov and contributors.

This project is licensed under the [GNU Affero General Public License v3.0 or later](LICENSE) (`AGPL-3.0-or-later`).

## Feedback

Feedback from translators is welcome. Open a GitHub issue with a clear description and, where useful, a screenshot or small reproducible sample.
