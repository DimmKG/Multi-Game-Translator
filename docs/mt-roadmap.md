# Machine translation roadmap

This document tracks the planned evolution of machine translation support. It is an implementation roadmap, not a release schedule.

## Current state

The editor currently provides:

- an explicit project-specific machine-translation target selector;
- safe filename-based target suggestions for recognized `.lang` filenames;
- no universal Russian fallback;
- disabled machine-translation actions until a target is selected;
- project/session persistence for the selected target;
- a shared machine-translation provider registry;
- Google isolated behind the provider interface;
- a provider selector and global preferred-provider persistence;
- matching hosted and standalone builds.

Google remains the only registered provider. The provider configuration foundation, encrypted secret vault and configurable font preferences are complete. The current sequence is issue #35 (Settings tabs), issue #27 (reference/provider wording and locale pass), Stage 3B (LibreTranslate-compatible provider), then Stage 3C (DeepL).

The language used by the interface, the language represented by the loaded `.lang` file, the source/reference file and the language used by machine translation are separate concepts and must remain independent.

## Decisions

- The interface language must never determine the machine-translation target.
- The browser language must never determine the machine-translation target.
- Russian must not be used as a universal fallback.
- A target language may be suggested from a recognized localization filename such as `bg.lang`, `pt-BR.lang` or `zh-TW.lang`.
- Unrecognized filenames such as `prototype.lang`, `translation.lang` or `new.lang` must not trigger a guessed target language.
- Manual editing must remain available without selecting a machine-translation language.
- Machine translation must remain disabled until a target language is known.
- A target selected for one project must not become a mandatory global target for future projects.
- The selected target may be stored in the current progress/session data so that restoring the same project restores its machine-translation target.
- A preferred provider may be stored globally because provider preference is independent from the language of the current project.
- Provider-specific language aliases belong inside the provider implementation.
- API keys and custom endpoints must remain local to the browser and must never be committed or sent to this repository.
- Provider additions should be split into separate pull requests when they have different configuration, CORS, credential or policy requirements.

## Completed stages

### Stage 1: safe target-language selection

Completed in [PR #26](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/26).

Implemented:

- replaced the free-form target field with a target-language selector;
- populated it from the supported Necesse game-language list;
- added safe filename-based suggestions;
- preserved an explicit unselected state for unknown filenames;
- disabled machine translation until a target is selected;
- stored and restored the selected target with project/session data;
- removed the silent Russian fallback;
- kept manual translation, review, comparison and export available without machine translation.

### Stage 2: provider abstraction

Completed in [PR #28](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/28).

Implemented:

- introduced a shared provider registry with a stable translation interface;
- moved Google-specific requests and language normalization out of `app.js`;
- routed editor translation requests through the provider registry;
- added a provider selector;
- added global preferred-provider persistence;
- kept project/session provider persistence;
- loaded the provider layer in hosted and standalone builds;
- added regression coverage for registry use, provider selection and Google alias ownership.

## Next stages

Stage 3 is deliberately split into smaller provider-focused steps. The exact number of pull requests may change as browser and service constraints are tested.

### Stage 3A: provider configuration foundation

Completed through PR #32, followed by the encrypted secret vault in PR #33 and configurable font preferences in PR #34.

Implemented:

- define provider metadata for configurable fields;
- add provider settings to the existing Settings panel rather than the main translation toolbar;
- support local persistence for non-secret preferences such as a custom endpoint;
- support local-only storage for user-supplied API keys;
- provide clear reset/remove controls;
- prevent credentials from entering project exports, progress files, logs or repository files;
- define shared validation and availability states;
- keep Google usable without configuration;
- add regression coverage for settings isolation and persistence.

This stage should also establish the final terminology for:

- reference file;
- source language;
- target language;
- provider.

After those concepts are stable, [issue #27](https://github.com/AcTePuKc/Necesse-Lang-Translator/issues/27) can update the remaining `en.lang`-specific interface wording and locale keys in one focused pass.

### Stage 3B: LibreTranslate-compatible provider

Goal: prove that the provider abstraction supports configurable and self-hosted services.

Planned changes:

- add a configurable LibreTranslate-compatible endpoint;
- support an optional API key;
- define source and target language normalization;
- map network, HTTP and provider response errors into shared editor errors;
- test hosted GitHub Pages and standalone browser behaviour;
- document CORS requirements for self-hosted endpoints;
- document exactly what text is sent to the configured endpoint.

LibreTranslate compatibility should be implemented against documented API behaviour rather than assumptions about one public instance.

### Stage 3C: DeepL provider

Goal: add DeepL after the shared configuration path has been proven by another provider.

Planned changes:

- support user-supplied DeepL credentials;
- distinguish supported DeepL endpoint variants where necessary;
- normalize DeepL-specific language codes;
- map quota, authentication and request errors;
- verify whether direct browser requests are practical and appropriate;
- document credential exposure considerations for hosted GitHub Pages use.

DeepL should remain a separate pull request because its authentication, endpoint and policy constraints differ from LibreTranslate.

### Stage 3D: additional conventional providers

Optional future providers may be considered individually after Stage 3B and Stage 3C.

Each candidate must be reviewed for:

- supported source and target language codes;
- required credentials or endpoint configuration;
- request limits;
- browser CORS support;
- credential exposure;
- terms of use;
- suitability for hosted and standalone builds;
- maintenance cost.

Providers must not be added merely because an endpoint exists.

### Stage 4: AI translation providers

Goal: support opt-in AI-assisted translation through user-supplied APIs.

Possible providers may include OpenAI-compatible APIs or local/self-hosted models.

This stage requires decisions about:

- single-line versus batch translation;
- optional neighbouring-string context;
- terminology glossary instructions;
- placeholder and formatting-token masking;
- system and user prompt structure;
- maximum request size;
- retries and rate limits;
- cost visibility;
- cancellation;
- privacy messaging;
- sending copyrighted game text to an external service;
- secure local handling of API keys;
- compatibility with hosted and standalone builds.

AI output must remain a suggestion. It must not bypass the existing review, token-safety or terminology checks.

## Interface guidance

The machine-translation controls should distinguish clearly between:

- **Provider** — which service performs the translation;
- **Source/reference file** — the loaded file supplying the source text;
- **Source language** — the language sent to a provider when required;
- **Target language** — the language of the current localization project;
- **Interface language** — the language of the editor itself.

Suggested target-language help text:

> Used only for machine translation. When possible, the editor suggests a language from the loaded `.lang` filename.

For an unknown filename:

> The target language could not be determined from the filename. Select one before using machine translation.

For an automatically recognized filename:

> Suggested from `bg.lang`. Check the selection before translating.

## Completion tracking

- [x] Stage 1 — safe target-language selection ([PR #26](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/26))
- [x] Stage 2 — provider abstraction ([PR #28](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/28))
- [x] Stage 3A — provider configuration foundation ([PR #32](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/32))
- [x] Encrypted provider-secret vault ([PR #33](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/33))
- [x] Configurable font preferences ([PR #34](https://github.com/AcTePuKc/Necesse-Lang-Translator/pull/34))
- [ ] Issue #35 — Settings tabs and responsive dialog
- [ ] Issue #27 — reference-file wording and locale pass
- [ ] Stage 3B — LibreTranslate-compatible provider
- [ ] Stage 3C — DeepL provider
- [ ] Stage 3D — additional conventional providers, if justified
- [ ] Stage 4 — AI translation providers

Update this document when decisions change or a stage is completed. Link the relevant pull request next to each completed item.