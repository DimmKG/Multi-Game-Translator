// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NormalizedGlossary } from "@/core/glossary/loader";

import { openNecesseDb, type StoredGlossaryRecord } from "./idb";

export const GLOSSARY_STORAGE_KEY = "necesse-translator.glossaries.v1";

export interface StoredGlossary extends NormalizedGlossary {
  enabled: boolean;
}

function readLegacyGlossaries(): StoredGlossary[] {
  try {
    const raw = JSON.parse(localStorage.getItem(GLOSSARY_STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? (raw as StoredGlossary[]) : [];
  } catch {
    return [];
  }
}

function clearLegacyGlossaries() {
  try {
    localStorage.removeItem(GLOSSARY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function loadGlossariesFromIdb(): Promise<StoredGlossary[]> {
  const db = await openNecesseDb();
  return (await db.getAll("glossaries")) as StoredGlossary[];
}

export async function saveGlossaryToIdb(glossary: StoredGlossary) {
  const db = await openNecesseDb();
  await db.put("glossaries", glossary as StoredGlossaryRecord);
}

export async function removeGlossaryFromIdb(id: string) {
  const db = await openNecesseDb();
  await db.delete("glossaries", id);
}

export async function replaceGlossariesInIdb(glossaries: readonly StoredGlossary[]) {
  const db = await openNecesseDb();
  const tx = db.transaction("glossaries", "readwrite");
  await tx.store.clear();
  for (const glossary of glossaries) {
    await tx.store.put(glossary as StoredGlossaryRecord);
  }
  await tx.done;
}

/**
 * One-shot: copy legacy localStorage glossaries into IndexedDB when the store is empty.
 */
export async function migrateGlossariesFromLocalStorage(): Promise<StoredGlossary[]> {
  const existing = await loadGlossariesFromIdb();
  if (existing.length) {
    clearLegacyGlossaries();
    return existing;
  }

  const legacy = readLegacyGlossaries();
  if (legacy.length) {
    await replaceGlossariesInIdb(legacy);
    clearLegacyGlossaries();
  }
  return legacy;
}
