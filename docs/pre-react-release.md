# Pre-React release and handoff

This document describes how to freeze, verify and publish the stable HTML/JavaScript application before the React and TypeScript migration begins.

## Release identity

- Version: `0.9.0-pre-react.1`
- Intended tag: `v0.9.0-pre-react.1`
- Release type: GitHub pre-release
- Distribution files:
  - repository source at the tag;
  - `dist/necesse-lang-translator.html` as the offline standalone application.

The final tag must point to the merge commit of the release-preparation PR after all automated and manual checks pass.

Final tagged commit SHA: `d4bf92ba0cfb462ac791da5cd755d506cca5015f`.

## Freeze rules

After the tag is created:

- the tagged HTML application becomes the behavioural reference for migration parity;
- reviewed locale text must not be regenerated or rewritten;
- parser, serializer, recovery, provider, vault and Compact workspace behaviour must be compared against this baseline;
- unrelated features should wait until the first React implementation reaches parity;
- urgent HTML fixes require a documented follow-up release and corresponding migration-contract update.

## Automated verification

From a clean checkout of the release candidate:

```powershell
npm run verify
```

The command must pass:

- Node test suite;
- built-in locale validation;
- installable interface-locale validation;
- glossary validation;
- standalone build;
- standalone integrity check.

The working tree should remain clean except for generated files that are intentionally tracked and already match the committed build.

## Manual smoke checklist

### Workspace and files

- [ ] open a translated `.lang` file;
- [ ] open a file containing `MISSING_TRANSLATION:` entries;
- [ ] load an English reference file;
- [ ] verify filename and progress information;
- [ ] edit a value containing placeholders and literal `\n`;
- [ ] export and compare the result with the expected structure;
- [ ] save and reload a progress file;
- [ ] verify unfinished-session recovery;
- [ ] open another workspace and confirm stale recovery is dismissed.

### Views and QA

- [ ] Editor search and filters work;
- [ ] section navigation works;
- [ ] whitespace issues are visible and filterable;
- [ ] terminology warnings appear with an enabled glossary;
- [ ] Review shows translated entries and detected issues;
- [ ] Compare loads another file;
- [ ] word and character comparison modes work;
- [ ] same-as-reference status appears only when reference data exists.

### Compact workspace

- [ ] Compact view preserves edits and active state;
- [ ] Editor shows Search, Filters and Sections;
- [ ] Review shows Search but not Editor-only tools;
- [ ] Compare hides Search, Filters and Sections;
- [ ] Actions exposes file operations in every view;
- [ ] Translation tools appear only in Editor;
- [ ] Settings opens from the rail and navigation drawer;
- [ ] Escape closes dialogs/drawers before leaving Compact view;
- [ ] focus returns to the invoking rail button;
- [ ] narrow-width layout retains a visible exit action.

### Localization and layout

- [ ] English interface works;
- [ ] Bulgarian interface works;
- [ ] Russian interface works;
- [ ] one provisional locale falls back to English for missing keys;
- [ ] Arabic switches the document to RTL;
- [ ] filenames, keys and technical values remain left-to-right in RTL;
- [ ] layouts remain usable at 80%, 100% and 125% browser zoom;
- [ ] separate interface and editor font preferences work.

### Translation assistance and secrets

- [ ] MT provider selection persists correctly;
- [ ] explicit MT target remains separate from UI language;
- [ ] unknown filenames do not silently select a target;
- [ ] spellcheck and autocomplete toggles remain synchronized between standard and Compact controls;
- [ ] provider credentials are memory-only by default;
- [ ] encrypted vault export/import works;
- [ ] wrong password and tampered vault data fail closed;
- [ ] normal progress and translation exports contain no secrets;
- [ ] locking clears decrypted credentials.

### Hosted and standalone

- [ ] hosted GitHub Pages build opens and loads public catalogs;
- [ ] standalone HTML opens directly through `file://`;
- [ ] local file, progress, glossary and interface-locale import work in standalone mode;
- [ ] controls requiring unavailable hosted resources are hidden in standalone mode;
- [ ] hosted and standalone translation output is equivalent.

## Release notes

### Necesse .lang Translator `0.9.0-pre-react.1`

This pre-release freezes the completed HTML/JavaScript application before migration to React and TypeScript.

Highlights:

- full Editor, Review and Compare workflows;
- Compact workspace with contextual navigation and actions;
- deterministic `.lang` parsing and export;
- placeholder, formatting, whitespace and terminology QA;
- reference files, progress files and session recovery;
- machine-translation providers, spellcheck and autocomplete;
- memory-first credentials and optional encrypted vault;
- 29 built-in interface locales with English fallback and RTL support;
- configurable interface/editor fonts;
- hosted GitHub Pages and single-file offline editions;
- automated tests, validators and build integrity checks.

This is a pre-release because the next development phase changes the frontend architecture. It is nevertheless the stable behavioural baseline and the version against which React parity must be measured.

## Tag and release procedure

After the release-preparation PR is merged:

1. record the resulting `main` commit SHA in this document and `docs/react-migration-contract.md`;
2. update Issue #51 with the same SHA and the final tag name;
3. run `npm run verify` from the exact commit;
4. create annotated tag `v0.9.0-pre-react.1`;
5. create a GitHub pre-release from that tag;
6. use the release notes above;
7. attach `dist/necesse-lang-translator.html`;
8. download the attachment and open it through `file://` as a final independent check;
9. confirm the GitHub Pages deployment corresponds to the tagged source;
10. begin React migration only after the release is retrievable.

## Handoff package

The migration handoff consists of:

- the tagged source repository;
- the standalone HTML release attachment;
- `README.md`;
- `CHANGELOG.md`;
- `docs/react-migration-contract.md`;
- this release procedure;
- Issue #51 as the living migration tracker;
- current tests and fixtures as behavioural specifications.
