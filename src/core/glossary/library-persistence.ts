// SPDX-License-Identifier: AGPL-3.0-or-later

import { normalizeGlossary, type NormalizedGlossary } from "./loader";

export const GLOSSARY_LIBRARY_STORAGE_KEY = "necesse-translator.glossaries.v1";

export interface StoredGlossary extends NormalizedGlossary {
  enabled: boolean;
}

function normalizeStoredGlossary(value: unknown): NormalizedGlossary {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).game === ""
  ) {
    const migrated = { ...(value as Record<string, unknown>) };
    delete migrated.game;
    return normalizeGlossary(migrated);
  }
  return normalizeGlossary(value);
}

function serializableStoredGlossary(glossary: Readonly<StoredGlossary>) {
  const { game, ...rest } = glossary;
  return game ? { ...rest, game } : rest;
}

export function loadGlossaryLibrary(storage: Storage = localStorage): StoredGlossary[] {
  try {
    const parsed = JSON.parse(storage.getItem(GLOSSARY_LIBRARY_STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];

    const glossaries: StoredGlossary[] = [];
    for (const value of parsed) {
      try {
        const normalized = normalizeStoredGlossary(value);
        const enabled =
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>).enabled !== false
            : true;
        glossaries.push({ ...normalized, enabled });
      } catch {
        // One damaged stored glossary must not hide the rest of the library.
      }
    }
    return glossaries;
  } catch {
    return [];
  }
}

export function saveGlossaryLibrary(
  glossaries: readonly StoredGlossary[],
  storage: Storage = localStorage,
): boolean {
  try {
    storage.setItem(
      GLOSSARY_LIBRARY_STORAGE_KEY,
      JSON.stringify(glossaries.map(serializableStoredGlossary)),
    );
    return true;
  } catch {
    return false;
  }
}

export function upsertGlossaryLibrary(
  glossaries: readonly StoredGlossary[],
  glossary: NormalizedGlossary,
): StoredGlossary[] {
  const existing = glossaries.find((item) => item.id === glossary.id);
  const next: StoredGlossary = {
    ...glossary,
    enabled: existing?.enabled ?? true,
  };
  return existing
    ? glossaries.map((item) => (item.id === glossary.id ? next : item))
    : [...glossaries, next];
}

export function setGlossaryLibraryEnabled(
  glossaries: readonly StoredGlossary[],
  id: string,
  enabled: boolean,
): StoredGlossary[] {
  return glossaries.map((glossary) => (glossary.id === id ? { ...glossary, enabled } : glossary));
}

export function removeFromGlossaryLibrary(
  glossaries: readonly StoredGlossary[],
  id: string,
): StoredGlossary[] {
  return glossaries.filter((glossary) => glossary.id !== id);
}
