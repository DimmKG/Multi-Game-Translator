# Changelog

All notable user-visible changes to Necesse .lang Translator are documented here.

## 0.9.0-pre-react.1 — 2026-08-02

Stable HTML/JavaScript baseline prepared before the React and TypeScript migration.

### Translation workspace

- added structured editing for Necesse `.lang` files while preserving keys, comments, sections, ordering and line endings;
- added explicit missing, translated and same-as-reference states;
- added section navigation, search, filters and live progress information;
- added focused Editor, Review and Compare views;
- added word-level and character-level inline comparison;
- added a non-destructive Compact workspace with contextual icon rail, temporary drawers, file actions and translation tools;
- added responsive, narrow-width, keyboard-focus and RTL behaviour for the Compact workspace.

### File safety and recovery

- added deterministic parsing and serialization tests;
- added placeholder, reference, formatting-code and literal-newline validation;
- added portable progress import and export;
- added unfinished-session recovery and stale-recovery dismissal;
- prevented implicit target-language selection from UI language, browser language, Russian, English or the first selector option;
- kept target files and reference files as separate concepts.

### QA and terminology

- added whitespace detection and filtering;
- added glossary import, hosted catalog support and update checks;
- added preferred, alternative, grammatical-form and forbidden-term handling;
- added terminology warnings to Editor and Review workflows;
- protected placeholders and formatting tokens during terminology checks.

### Interface localization

- introduced separate JSON locale files as the hand-edited source of truth;
- made English the canonical fallback locale;
- preserved reviewed English, Bulgarian and Russian translations;
- added provisional built-in languages with English fallback;
- added installable partial interface-locale packages;
- added interface-locale validation and generated runtime bundles;
- added Arabic RTL layout while preserving technical values as left-to-right.

### Translation assistance and settings

- added provider-based machine-translation integration;
- separated interface language, translation target, reference language and MT target;
- added explicit provider and target-language persistence rules;
- added spelling and autocomplete controls;
- added localized Settings;
- added separate interface and editor font-family preferences;
- added memory-first secret handling and an optional encrypted credential vault;
- prevented secrets from entering normal progress, localization or diagnostic exports.

### Distribution and validation

- added the hosted GitHub Pages application;
- added a generated single-file standalone HTML edition with direct `file://` support;
- documented hosted and standalone capability differences;
- added automated tests, locale validators, glossary validators and standalone integrity checks;
- added a read-only GitHub Actions verification workflow;
- preserved the original standalone editor under `legacy/`.

### Migration status

- froze this release line as the behavioural reference for the React/TypeScript migration;
- added a permanent migration contract requiring feature parity before expansion;
- documented the release and handoff procedure.
