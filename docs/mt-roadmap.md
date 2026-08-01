# Machine translation roadmap

This document tracks the planned evolution of machine translation support. It is an implementation roadmap, not a release schedule.

## Current state

The editor currently uses a Google translation endpoint inherited from the original standalone prototype.

The existing implementation still contains assumptions from the original Russian-focused workflow:

- the default localization filename is `ru.lang`;
- the default machine-translation target is `ru`;
- an empty or unrecognized target language may fall back to Russian;
- the target language is entered in a free-form text field;
- the translation provider is effectively hard-coded to Google.

The language used by the interface, the language represented by the loaded `.lang` file and the language used by machine translation are separate concepts and must remain independent.

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
- API keys and custom endpoints must remain local to the browser and must never be committed or sent to this repository.

## Proposed implementation stages

The stages below may be split into additional pull requests when that keeps reviews smaller and safer.

### Stage 1: safe target-language selection

Goal: remove Russian defaults and make the target language explicit and project-specific.

Planned changes:

- replace the free-form `mtTarget` input with a target-language selector;
- populate it from the supported Necesse game-language list rather than the interface-locale registry;
- suggest a target from a recognized `.lang` filename;
- normalize provider-specific aliases such as `pt-BR` to the value expected by the current provider;
- show an unselected state for unknown filenames;
- disable machine-translation actions until a target is selected;
- allow the user to change the suggested target at any time;
- store the selected target in progress/session data for the current project;
- restore the selected target with that project;
- remove `ru` as the fallback for missing target-language data;
- keep manual translation, review, comparison and export usable without machine translation.

Expected examples:

| Loaded filename | Suggested target |
| --- | --- |
| `bg.lang` | Bulgarian (`bg`) |
| `pt-BR.lang` | Portuguese (`pt`) for the current Google endpoint |
| `zh-TW.lang` | Traditional Chinese (`zh-TW`) |
| `prototype.lang` | No selection |

Validation should cover at least:

- recognized language-code filenames;
- regional aliases;
- the existing `pr-BR` typo correction;
- unknown filenames;
- restoring a project-specific target;
- changing the suggested target;
- no silent Russian fallback;
- standalone and hosted builds.

### Stage 2: provider abstraction

Goal: separate the editor workflow from any single translation service.

Planned changes:

- introduce a provider registry with a stable translation interface;
- move Google-specific language normalization into the Google provider;
- add a provider selector to the machine-translation controls;
- add a preferred-provider setting;
- keep temporary provider switching available directly from the editor;
- define shared error, loading, cancellation and retry behaviour;
- ensure placeholders and formatting tokens remain protected before text is sent to a provider;
- document what data each provider receives.

A possible internal shape:

```js
const MT_PROVIDERS = {
  google: {
    normalizeLanguage(code) {},
    translate(request) {},
  },
};
```

The exact API should be decided during implementation rather than treated as fixed by this example.

### Stage 3: additional conventional providers

Goal: add providers that fit the abstraction without introducing AI-prompt complexity.

Possible candidates:

- DeepL;
- LibreTranslate;
- compatible self-hosted translation endpoints.

Each provider should define:

- supported source and target language codes;
- language-code normalization;
- required credentials or endpoint configuration;
- request limits;
- error mapping;
- whether browser requests are supported directly;
- whether the provider is suitable for the hosted GitHub Pages version.

Providers must not be added merely because an endpoint exists. Browser security, CORS behaviour, credential exposure and terms of use must be reviewed first.

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
- **Target language** — the language of the current localization project;
- **Interface language** — the language of the editor itself.

Suggested target-language help text:

> Used only for machine translation. When possible, the editor suggests a language from the loaded `.lang` filename.

For an unknown filename:

> The target language could not be determined from the filename. Select one before using machine translation.

For an automatically recognized filename:

> Suggested from `bg.lang`. Check the selection before translating.

## Out of scope for the first stage

The first target-language PR should not also add:

- multiple providers;
- API-key settings;
- AI prompts;
- global preferred target languages;
- automatic language detection from translated text;
- assumptions based on the interface or browser language.

Keeping these concerns separate should make each change easier to test, review and revert.

## Completion tracking

- [ ] Stage 1 — safe target-language selection
- [ ] Stage 2 — provider abstraction
- [ ] Stage 3 — additional conventional providers
- [ ] Stage 4 — AI translation providers

Update this document when decisions change or a stage is completed. Link the relevant pull request next to the completed item.