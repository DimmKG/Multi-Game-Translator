# Glossaries

Glossaries provide preferred, grammatical, alternative and forbidden terminology without hard-coding a specific translation into the application.

They are ordinary JSON files. The same glossary format is used for local import and online catalogs.

## Quick start

Start from `glossaries/examples/bg.example.json`, change the glossary metadata and replace the example entries.

A minimal glossary looks like this:

```json
{
  "$schema": "../../schemas/glossary-v1.schema.json",
  "format": "necesse-glossary",
  "version": 1,
  "id": "necesse-bg-community",
  "name": "Necesse Bulgarian Community Glossary",
  "sourceLanguage": "en",
  "targetLanguage": "bg",
  "game": "Necesse",
  "authors": ["Translator name"],
  "updatedAt": "2026-08-01",
  "entries": [
    {
      "source": "Settler",
      "target": "Заселник"
    }
  ]
}
```

Import the file through **Glossaries → Import glossary**. Re-importing a glossary with the same `id` replaces the stored copy and preserves whether it was enabled or disabled.

## Top-level fields

Required fields:

| Field | Meaning |
| --- | --- |
| `format` | Must be `necesse-glossary`. |
| `version` | Format version. Currently `1`. |
| `id` | Stable machine-readable identifier. Do not change it merely because the contents changed. |
| `name` | Display name shown in Glossary Manager. |
| `sourceLanguage` | Source language tag, normally `en`. |
| `targetLanguage` | Translation language tag such as `bg`, `de` or `pt-BR`. |
| `entries` | Array of terminology rules. |

Optional metadata:

| Field | Meaning |
| --- | --- |
| `game` | Game or project name. |
| `authors` | Contributor names. |
| `updatedAt` | Last content update in `YYYY-MM-DD` format. Online catalogs use this value for update checks. |

Use a stable lowercase `id` containing letters, digits, dots, underscores or hyphens, for example `necesse-bg-community`.

## Entry fields

Every entry requires:

```json
{
  "source": "Settler",
  "target": "Заселник"
}
```

### `source`

The source term that must appear in the English text before the rule applies.

A glossary entry for `Settler` does not affect unrelated strings. Protected localization tokens are masked before matching, so `<settler>` and `[item=Settler]` do not activate the rule by themselves.

### `target`

The preferred base translation. This is the term shown in missing-terminology warnings.

```json
"target": "Заселник"
```

### `forms`

Grammatical forms of the same preferred term:

```json
"forms": [
  "Заселникът",
  "Заселника",
  "Заселници",
  "Заселниците"
]
```

Use `forms` for definite forms, plurals, declined forms, conjugations or other grammatical variants that still represent the same chosen term.

Do not add separate uppercase and lowercase copies when `caseSensitive` is `false`. For example, `Заселника` also accepts `заселника`.

### `alternatives`

Different translations that are also acceptable:

```json
"alternatives": ["Колонист"]
```

Keep `forms` and `alternatives` conceptually separate:

- `Заселникът` is a grammatical form of `Заселник`;
- `Колонист` is a different acceptable translation.

### `forbidden`

Terms that must trigger a QA warning:

```json
"forbidden": ["Преселник"]
```

A forbidden term can produce two related warnings:

1. the forbidden wording was found;
2. none of the accepted target terms was found.

That is intentional: one warning identifies what should be removed, while the other identifies what is expected.

### `caseSensitive`

Controls letter-case matching. The default is `false`.

```json
"caseSensitive": false
```

With `false`, `Заселника` matches `заселника`. Set it to `true` only when capitalization changes the meaning of the term.

### `wholeWord`

Controls whether the term must be a complete word. The default is `true`.

```json
"wholeWord": true
```

Keep it enabled for normal terminology. Set it to `false` only for a fragment, prefix, suffix or expression that legitimately occurs inside a larger token.

### `status`

Supported values:

| Status | Behaviour |
| --- | --- |
| `approved` | Normal active rule. This is the default. |
| `draft` | Active rule whose terminology is not yet final. |
| `context-dependent` | Active rule that may require human interpretation. |
| `deprecated` | Ignored by terminology QA. |

Example:

```json
"status": "context-dependent"
```

### `category`, `context` and `note`

These fields provide human guidance and appear in terminology details where applicable.

```json
{
  "category": "character",
  "context": "NPC profession name",
  "note": "Do not use this term for temporary visitors."
}
```

- `category` groups related terminology;
- `context` explains when the rule applies;
- `note` records a decision, exception or translator instruction.

They do not replace separate entries when two source terms genuinely require different matching rules.

## Complete entry example

```json
{
  "source": "Settler",
  "target": "Заселник",
  "forms": ["Заселникът", "Заселника", "Заселници", "Заселниците"],
  "alternatives": ["Колонист"],
  "forbidden": ["Преселник"],
  "caseSensitive": false,
  "wholeWord": true,
  "status": "approved",
  "category": "character",
  "context": "Permanent settlement resident",
  "note": "Forms are grammatical variants; alternatives are different acceptable translations."
}
```

## Protected localization syntax

Terminology matching ignores protected syntax rather than treating it as prose. This includes:

```text
<settler>
[item=Settler]
§a
§#FFAA00
\n
```

The masking applies to source matching, accepted target terms and forbidden-term checks.

Real prose still matches normally:

```text
The Settler arrives tomorrow.
```

## Local use

Local import works in both versions of the application:

- the generated standalone HTML opened through `file://`;
- the source or hosted HTTP application.

Local glossaries are stored in the browser's IndexedDB (a library saved by an
older version is migrated out of `localStorage` on first load). Enabling and
disabling a glossary does not reload its JSON; it only changes whether the saved
copy participates in QA.

To replace an older local copy, import the updated file again with the same `id`. Removing and importing it again also works.

## Online catalogs

Hosted versions can load `./glossaries/catalog.json`. A catalog describes available glossaries and their URLs; the glossary files themselves use the same format as local imports.

Example catalog entry:

```json
{
  "id": "necesse-bg-example",
  "name": "Necesse Bulgarian Glossary Example",
  "sourceLanguage": "en",
  "targetLanguage": "bg",
  "updatedAt": "2026-08-01",
  "url": "./necesse-bg-example.json"
}
```

When a catalog glossary is installed, the application stores its source URL. Loading the catalog again compares the installed glossary `updatedAt` value with the catalog value.

If a newer date is available:

- the installed record is highlighted;
- the old and new dates are shown;
- the user can explicitly update it;
- its enabled state is preserved.

Glossaries are never silently replaced. Local imports are never assigned an online update source automatically.

If a catalog cannot be reached, the editor continues working and local glossary import remains available.

## Publishing a catalog glossary

For the repository-provided catalog:

1. place the browser-accessible glossary under `src/glossaries/`;
2. add an entry to `src/glossaries/catalog.json`;
3. keep the catalog `id` identical to the glossary `id`;
4. update both `updatedAt` values when publishing a new revision;
5. run repository validation.

The repository also keeps schemas and authoring examples outside the public application tree. Files referenced by the runtime catalog must exist under `src/` because that directory is served by the local development server and GitHub Pages build.

## Validation

Run all glossary checks:

```powershell
npm run validate:glossaries
```

Or run the full project verification:

```powershell
npm run verify
```

Validation checks JSON syntax, supported format versions, identifiers, language tags, duplicate catalog IDs, referenced public files and required entry fields.

The JSON schemas under `schemas/` are the normative format descriptions. The dependency-free Node.js validator provides immediate repository checks without requiring package installation.

## Authoring checklist

Before publishing a glossary:

- keep the `id` stable;
- update `updatedAt` when terminology content changes;
- use `forms` for grammar and `alternatives` for different translations;
- avoid duplicate forms that differ only by case when matching is case-insensitive;
- use `forbidden` only for wording that should actually produce a warning;
- keep `wholeWord` enabled unless substring matching is intentional;
- preserve placeholders and formatting syntax in examples;
- run `npm run validate:glossaries`.
