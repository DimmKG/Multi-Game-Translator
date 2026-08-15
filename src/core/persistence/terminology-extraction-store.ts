// SPDX-License-Identifier: AGPL-3.0-or-later
import { openNecesseDb, type TerminologyExtractionRecord } from "./idb";
import { emptyTerminologyReviewState } from "@/core/terminology/review-state";

export type { TerminologyExtractionRecord, TerminologyCorpusFileRecord } from "./idb";

const META_TERMINOLOGY_EXTRACTION = "terminologyExtraction";
const VALID_SECTIONS = new Set(["sources", "review", "merge", "authoring"]);

// The stored shape isn't schema-versioned, so a record written by an earlier
// build of the app (before a field existed) must not be trusted as-is —
// default anything missing instead of letting `undefined` reach the caller.
function sanitize(record: unknown): TerminologyExtractionRecord | null {
  if (!record || typeof record !== "object") return null;
  const stored = record as Partial<TerminologyExtractionRecord>;
  return {
    sourceLanguageCode: stored.sourceLanguageCode ?? "en",
    sourceFile: stored.sourceFile ?? null,
    translatedFiles: Array.isArray(stored.translatedFiles) ? stored.translatedFiles : [],
    minimumFrequency: stored.minimumFrequency ?? 2,
    candidates: Array.isArray(stored.candidates) ? stored.candidates : [],
    reviewState: stored.reviewState ?? emptyTerminologyReviewState(),
    section: stored.section && VALID_SECTIONS.has(stored.section) ? stored.section : "sources",
    savedAt: stored.savedAt ?? 0,
  };
}

export async function loadTerminologyExtractionFromIdb(): Promise<TerminologyExtractionRecord | null> {
  try {
    const db = await openNecesseDb();
    const record = await db.get("meta", META_TERMINOLOGY_EXTRACTION);
    return sanitize(record);
  } catch {
    return null;
  }
}

export async function saveTerminologyExtractionToIdb(
  record: TerminologyExtractionRecord,
): Promise<void> {
  try {
    const db = await openNecesseDb();
    await db.put("meta", record, META_TERMINOLOGY_EXTRACTION);
  } catch {
    // Best-effort — losing this write only means the next reload starts fresh.
  }
}

export async function clearTerminologyExtractionFromIdb(): Promise<void> {
  try {
    const db = await openNecesseDb();
    await db.delete("meta", META_TERMINOLOGY_EXTRACTION);
  } catch {
    // Best-effort — a stale record left behind is harmless on next load.
  }
}
