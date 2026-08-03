# React parity completion audit

This document records the final review of the React/TypeScript migration tracked by Issue #51.

It distinguishes between:

- behavior verified by automated checks;
- behavior manually exercised during the parity PRs;
- requirements that are not part of either the preserved pre-React baseline or the current product;
- final release checks that remain intentionally manual.

## Baseline and migration record

- Pre-React version: `0.9.0-pre-react.1`
- Pre-React tag: `v0.9.0-pre-react.1`
- Baseline commit: `d4bf92ba0cfb462ac791da5cd755d506cca5015f`
- Permanent migration contract: `docs/react-migration-contract.md`
- Preserved original application: `legacy/necesse-lang-translator.original.html`
- Runtime interface-locale parity: PR #71
- Self-contained standalone build: PR #72

## Completed acceptance areas

### Baseline preservation

- [x] An annotated pre-React tag exists and is documented.
- [x] The legacy version remains retrievable.
- [x] The original standalone HTML is preserved in `legacy/` and in the pre-React release.
- [x] Generated build output is not the hand-edited source of truth.

### Parser, serializer and editor behavior

- [x] The parser and serializer are separate from React components.
- [x] Existing fixture and unit checks remain part of `npm run verify`.
- [x] Section order, key order, comments, blank lines, status prefixes and literal values are treated as file-format data rather than regenerated UI state.
- [x] Placeholder and formatting-token checks remain available.
- [x] Target and reference files remain distinct concepts.
- [x] Unknown filenames are not silently mapped to the interface language.
- [x] Review, compare, filters, counts, search, status changes and reference-dependent actions are present in the React application.
- [x] Progress import/export and local progress restoration are present.
- [x] Local and hosted glossary loading are present.

### Interface localization

- [x] English remains the canonical fallback locale.
- [x] Built-in locale codes are protected from replacement.
- [x] Partial installable interface locales use English fallback.
- [x] Runtime interface-locale packages can be imported, selected, persisted and removed.
- [x] Removing the active imported locale safely returns the UI to English.
- [x] The English interface-locale template can be exported.
- [x] Locale validation and regression tests are included in verification.

PR #71 supplied the final missing runtime package behavior and was manually checked for import, switching, persistence, replacement protection and removal fallback.

### Build and distribution

- [x] The normal Vite build remains suitable for static hosting and GitHub Pages.
- [x] `npm run preview` builds before serving and does not require tracked generated files.
- [x] `npm run preview:built` can preview an existing build.
- [x] `npm run build:standalone` produces a self-contained HTML file.
- [x] The standalone build inlines generated JavaScript, CSS and bundled assets.
- [x] The standalone packager rejects unresolved local asset references.
- [x] `dist-standalone` is generated and ignored.
- [x] The standalone build is included in `npm run verify`.
- [x] Repository line endings are defined by `.gitattributes`.

PR #72 was manually checked on Windows. It produced only:

```text
dist-standalone/necesse-lang-translator.html
```

The generated file opened directly through `file://` and retained the browser-only editor workflow.

## Requirements classified as not applicable

The migration contract contains defensive requirements for machine-translation providers, API credentials and an encrypted credential vault. Repository and preserved-baseline inspection found no corresponding product implementation to migrate. They are therefore not parity blockers.

Specifically:

- no provider credential UI is part of the current application;
- no API key persistence is part of the current application;
- no PBKDF2/AES-GCM vault format is present in the preserved baseline or current source;
- no provider-specific glossary or translation execution workflow is exposed by the current product.

Future machine-translation or credential-vault work must be treated as new functionality and reviewed in separate issues. The security rules in the migration contract remain valid design constraints for such future work.

## Final manual release checks

These checks are intentionally visual or browser-dependent and are not fully represented by unit tests:

- [ ] Open the hosted build in English, Bulgarian and Russian.
- [ ] Switch to an RTL locale and confirm document direction and logical layout.
- [ ] Check the header and Settings dialog at 80%, 100% and 125% browser zoom.
- [ ] Check a narrow/mobile viewport.
- [ ] Load a target file without a reference file and confirm reference-only actions remain unavailable.
- [ ] Load a reference file and confirm Review/Compare behavior becomes available.
- [ ] Edit and export a `.lang` file from the hosted build.
- [ ] Repeat the essential open/edit/export flow in the standalone `file://` build.
- [ ] Confirm `git status` remains clean after normal build and preview commands.

These checks should be recorded in the closing comment on Issue #51. A newly discovered functional mismatch should receive its own focused issue rather than extending the migration tracker indefinitely.

## Closure recommendation

Issue #51 can be closed when:

1. CI is green on the audit PR;
2. the final manual release checks above are completed or explicitly accepted as deferred visual QA;
3. no concrete pre-React behavior is known to be missing.

After closure, new React-only improvements should proceed as normal feature work. The migration contract remains an architectural and security reference, not an open-ended requirement to implement features that were absent from the baseline.
