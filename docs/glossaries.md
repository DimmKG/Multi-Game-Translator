# Glossaries

Glossaries provide preferred, grammatical, alternative and forbidden terminology without hard-coding a specific translation into the application.

## Local use

A user can import a glossary JSON file directly. Local import must remain available in the standalone HTML and must not require internet access.

## Online catalogs

Hosted versions may load `glossaries/catalog.json` and any additional catalogs configured by the user. Each catalog only describes available glossaries and their URLs. The glossary files themselves use the same format as locally imported files.

If a catalog cannot be reached, the editor must continue working and offer local glossary import.

## Glossary fields

Required top-level fields:

- `format`: `necesse-glossary`
- `version`: currently `1`
- `id`: stable machine-readable identifier
- `name`: display name
- `sourceLanguage` and `targetLanguage`: language tags
- `entries`: terminology entries

Each entry requires `source` and `target`. Optional fields include:

- `forms`: grammatical forms of the preferred `target`, such as definite, plural or declined forms
- `alternatives`: different translations that are also acceptable
- `forbidden`: forms that should trigger QA warnings
- `caseSensitive` and `wholeWord`: matching behaviour
- `status`: `approved`, `draft`, `deprecated` or `context-dependent`
- `category`, `context` and `note`: human guidance

Keep `forms` and `alternatives` conceptually separate. For example, `Заселникът` is a grammatical form of `Заселник`, while `Колонист` is a different acceptable translation.

See `glossaries/examples/bg.example.json` for a complete example.

## Validation

Run:

```powershell
npm run validate:glossaries
```

The validator checks JSON syntax, supported format versions, identifiers, language tags, duplicate catalog IDs and required entry fields.

The JSON schemas under `schemas/` are the normative format descriptions. The dependency-free Node.js validator provides immediate repository checks without requiring package installation.
