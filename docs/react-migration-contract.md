# React and TypeScript migration contract

This document defines the behavioural contract for migrating Necesse .lang Translator from the current HTML/JavaScript application to React and TypeScript.

The migration is not a mechanical conversion of DOM code. The new implementation should be native to React, use explicit typed state and separate domain logic from UI components. It must nevertheless preserve all validated file, localization, security and workflow behaviour before adding new features.

## Pre-migration freeze

Before React work begins:

- merge the release-preparation PR;
- make `main` pass the complete automated verification pipeline;
- complete the manual smoke checklist in English, Bulgarian, Russian and one RTL locale;
- create an annotated tag for `0.9.0-pre-react.1`;
- publish the standalone HTML file with the pre-release;
- record the final tagged commit SHA in this document, the release notes and Issue #51;
- avoid unrelated feature additions during the parity phase.

Final tagged baseline commit: `d4bf92ba0cfb462ac791da5cd755d506cca5015f`.

## Core rule

The first React release must reach **feature parity before feature expansion**.

A modern codebase is not an acceptable result if it silently changes parser behaviour, file output, localization fallback, recovery, provider rules, secret handling, keyboard behaviour, responsive layout or RTL behaviour.

## `.lang` parsing and export

The migrated application must:

- preserve section order, key order, comments and blank lines;
- preserve the original line-ending style;
- preserve status prefixes and their exact semantics;
- preserve keys and values exactly unless the user edits them;
- preserve placeholders, item references, formatting tokens and literal `\n` sequences;
- avoid normalizing, regenerating or correcting translation text automatically;
- keep deterministic exports;
- retain round-trip and fixture tests for representative `.lang` files.

Parser and serializer code must remain independent from React components.

## Workspace and files

The migrated application must:

- treat target translation files and reference files as distinct concepts;
- show the actual loaded filenames;
- preserve safe export filename behaviour;
- preserve progress import/export and unfinished-session recovery;
- dismiss stale recovery offers when another workspace is opened;
- preserve active view, filters, search, section and scroll state where the current application does;
- keep hosted and standalone behaviour aligned;
- never guess an unknown target language from UI language or browser language;
- never use Russian, English or the first selector option as a silent fallback;
- allow recognized filenames to suggest a language while leaving unknown filenames unselected.

## Views and Compact workspace

The migrated application must preserve:

- Editor, Review and Compare workflows;
- contextual search availability;
- filters, counts and section navigation;
- Compact workspace entry and exit;
- the contextual icon rail;
- temporary drawers and their focus return;
- file actions in all Compact views;
- translation tools only where they are contextually valid;
- Escape precedence for dialogs and drawers;
- narrow-width and RTL positioning.

The exact component design may change, but the user-visible workflow and state guarantees must remain compatible.

## Localization architecture

The migration must continue using separate locale JSON files as the only hand-edited source for built-in translations.

Required rules:

- English remains canonical, complete and the fallback;
- reviewed English, Bulgarian and Russian text is preserved exactly unless explicitly approved;
- provisional locales may omit keys and use English fallback;
- all built-in locale codes remain protected from imported packages;
- partial installable locale packages remain supported if the feature is retained;
- UI strings that belong in i18n must not be embedded directly in React components;
- generated locale bundles must not become editable source;
- document direction and logical CSS behaviour must be preserved;
- filenames, localization keys and other technical values remain left-to-right in RTL interfaces.

## Editor and QA functionality

The migrated application must preserve:

- missing, translated and same-as-reference states;
- same-as-reference status only when reference data exists;
- search, filters, counts and section navigation;
- placeholder and formatting-token validation;
- whitespace detection and filtering;
- glossary loading and terminology QA;
- preferred, alternative, grammatical-form and forbidden-term behaviour;
- Review integration and next-issue navigation;
- word and character comparison modes;
- spelling and autocomplete controls;
- keyboard shortcuts and focus behaviour;
- localized Settings and font preferences.

## Machine translation

Keep these concepts separate:

- interface language;
- loaded translation target;
- reference/source language;
- selected MT target;
- provider;
- provider settings and credentials.

Required rules:

- provider adapters remain independent from UI components;
- provider-specific constraints are represented honestly;
- no hardcoded `sl=en` assumption is presented as a general reference-file rule;
- saved explicit target selection has priority over recognized filename inference;
- unknown filename means no inferred target;
- translation remains opt-in and never overwrites text silently;
- provider controls in Compact view and standard view use the same state;
- glossary integration is preserved where supported.

## Secrets and encrypted vault

The migration must preserve or deliberately version the existing security guarantees:

- secrets are memory-only by default;
- API keys, passphrases and decrypted vault data are not stored in `localStorage`, `sessionStorage`, cookies, logs or diagnostics;
- passwords/passphrases are never stored;
- normal project, progress and localization exports never include secrets;
- locking clears decrypted credentials from application state;
- wrong passwords, tampering and unsupported versions fail closed;
- PBKDF2/AES-GCM parameters and authenticated metadata remain compatible unless a separately reviewed vault format version is introduced;
- an incompatible vault change requires migration documentation and tests.

## Font settings

Preserve:

- separate interface and editor font-family preferences;
- storage of font-family names only;
- multilingual previews and safe fallback stacks;
- the rule that local font files are never uploaded, embedded or distributed.

## Hosted and standalone builds

The React implementation must provide:

- a hosted build suitable for GitHub Pages;
- deterministic release output;
- a documented package-manager lockfile policy;
- clean local development and preview commands that do not dirty tracked generated files;
- a standalone distributable if technically viable.

True direct `file://` support is part of the current baseline. If the React toolchain cannot retain it, that must be treated as an explicit product decision with documented impact, alternatives and approval—not as an accidental regression.

## Recommended architecture

The exact names may differ, but the following boundaries should exist:

```text
src/
  core/
    lang-parser/
    serializer/
    validation/
    compare/
    glossary/
    target-language/
    providers/
    vault/
  app/
    components/
    features/
    hooks/
    state/
    views/
  i18n/
    locales/
    registry/
  build/
```

Principles:

- parser and serializer do not depend on React;
- validation and comparison are pure and testable;
- provider adapters do not manipulate the DOM;
- encrypted-vault code does not depend on UI components;
- React components consume services and explicit state transitions;
- file-format logic does not live inside components;
- one giant untyped state object is not carried forward.

## Patterns not to copy

Feature parity does not require preserving:

- monolithic HTML or application scripts;
- widespread `getElementById()` orchestration;
- UI injection based on DOM load order;
- hardcoded interface text;
- language-specific fixed widths;
- generated locale bundles as source;
- implicit language defaults;
- side effects mixed into parsing and serialization;
- temporary GitHub Actions helper workflows as product architecture.

## Testing requirements

Reuse the current tests as behavioural specifications where practical. Add equivalent or stronger coverage for:

- `.lang` round trips and deterministic exports;
- comments, sections, ordering and line endings;
- status prefixes;
- placeholders and formatting tokens;
- unknown filename target behaviour;
- absence of language-specific defaults;
- English fallback and locale validation;
- RTL rendering and logical layout;
- Compact workspace context and focus behaviour;
- session recovery;
- glossary behaviour;
- provider and target selection;
- encrypted-vault import/export, tamper detection and locking;
- hosted build;
- standalone/direct-file behaviour;
- clean local preview workflow.

Component tests alone are insufficient. Keep unit tests for domain modules and add a small set of end-to-end parity flows.

## Suggested migration sequence

1. Tag and publish the stable pre-React baseline.
2. Capture representative fixtures and expected exports.
3. Introduce TypeScript and build tooling without changing behaviour.
4. Extract pure parser, serializer and validation modules.
5. Extract provider, glossary and vault services.
6. Build the React shell and typed state model.
7. Migrate one view or feature area at a time.
8. Run old and new implementations against the same fixtures where practical.
9. Complete automated parity checks.
10. Perform manual checks in English, Bulgarian, Russian and an RTL locale.
11. Switch the production entry point only after parity review.
12. Remove the legacy UI in a separate cleanup step.

## Acceptance checklist

The React application may replace the HTML baseline only when:

- [ ] the pre-React tag and release are documented;
- [ ] the HTML version remains retrievable and buildable;
- [ ] all required current tests pass or have equivalent replacements;
- [ ] parser/export fixture outputs match;
- [ ] reviewed locale text is unchanged unless explicitly approved;
- [ ] no implicit language default exists;
- [ ] hosted build works;
- [ ] standalone/direct-file behaviour meets the agreed requirement;
- [ ] local preview leaves a clean working tree;
- [ ] session recovery works;
- [ ] reference-dependent UI is correct with and without a reference file;
- [ ] Compact workspace context and focus behaviour are preserved;
- [ ] MT provider and target rules are preserved;
- [ ] secret handling and encrypted-vault behaviour are preserved;
- [ ] responsive checks pass at 80%, 100%, 125% and narrow widths;
- [ ] RTL manual checks pass;
- [ ] feature parity is reviewed before new features are merged.

## Ownership and intentional changes

Dima/Claude may choose the React patterns, state library, component structure and bundler. They should not reproduce the old implementation style.

Any intentional behavioural change from this contract must be called out in the migration PR with:

- the reason;
- affected tests;
- compatibility impact;
- user-visible impact;
- explicit approval before replacing the baseline.
