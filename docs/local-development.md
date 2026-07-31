# Local development

The application can be used locally in two forms.

## Source version

Run:

```powershell
npm run dev
```

Open `http://127.0.0.1:4173` in a browser.

This mode serves files from `src/` and is intended for development. It is also the correct local mode for features that load external locale packs, glossary catalogs or other data files.

## Standalone preview

Run:

```powershell
npm run preview
```

This first rebuilds `dist/necesse-lang-translator.html`, then serves the `dist/` directory at the same address.

## Custom port

Set the `PORT` environment variable before starting the server:

```powershell
$env:PORT=8080
npm run dev
```

The local server binds only to `127.0.0.1`, disables browser caching and requires no third-party packages.
