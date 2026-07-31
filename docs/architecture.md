# Architecture plan

## Non-negotiable migration rules

1. Preserve all existing functionality during modularisation.
2. Preserve every technical instruction and explanatory comment.
3. Convert Russian-only or duplicated Russian and English guidance into one clear English version only after its original meaning has been reviewed.
4. Keep the generated standalone HTML available for offline use.
5. Keep translation files and project data local unless the user explicitly invokes an online service.

## Planned data extensions

Future interface locale packs and glossaries will use versioned JSON formats validated before loading.

A glossary may be loaded from a local file or discovered through an online catalog. Online resources must never be the only way to use the feature.
