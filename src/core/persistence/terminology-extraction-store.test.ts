// SPDX-License-Identifier: AGPL-3.0-or-later
import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeNecesseDb, DB_NAME, resetNecesseDbCache } from "./idb";
import {
  clearTerminologyExtractionFromIdb,
  loadTerminologyExtractionFromIdb,
  saveTerminologyExtractionToIdb,
  type TerminologyExtractionRecord,
} from "./terminology-extraction-store";
import type { TerminologyCandidate } from "@/core/terminology/extract-candidates";
import { emptyTerminologyReviewState } from "@/core/terminology/review-state";

beforeEach(async () => {
  await closeNecesseDb();
  await deleteDB(DB_NAME);
  resetNecesseDbCache();
});

afterEach(async () => {
  await closeNecesseDb();
});

describe("terminology extraction store", () => {
  const sampleCandidate = (): TerminologyCandidate => ({
    source: "Hello",
    sourceFrequency: 3,
    sourceKeys: ["key"],
    sections: [],
    languages: [
      {
        languageCode: "bg",
        filename: "bg.lang",
        matchedCount: 3,
        variants: [{ value: "Здравей", count: 3, ratio: 1, evidenceKeys: ["key"] }],
        dominantVariant: "Здравей",
        dominantRatio: 1,
        hasConflict: false,
      },
    ],
    evidence: [{ key: "key", section: "", source: "Hello", target: "Здравей" }],
  });

  const sampleRecord = (
    overrides: Partial<TerminologyExtractionRecord> = {},
  ): TerminologyExtractionRecord => ({
    sourceLanguageCode: "en",
    sourceFile: { id: "src", languageCode: "en", filename: "en.lang", text: "key=Hello" },
    translatedFiles: [{ id: "tr", languageCode: "bg", filename: "bg.lang", text: "key=Здравей" }],
    minimumFrequency: 2,
    candidates: [sampleCandidate()],
    reviewState: {
      ...emptyTerminologyReviewState(),
      decisions: { Hello: "accepted" },
    },
    section: "review",
    savedAt: 1,
    ...overrides,
  });

  it("returns null when nothing has been saved", async () => {
    expect(await loadTerminologyExtractionFromIdb()).toBeNull();
  });

  it("round-trips a saved record", async () => {
    await saveTerminologyExtractionToIdb(sampleRecord());
    const loaded = await loadTerminologyExtractionFromIdb();
    expect(loaded).toEqual(sampleRecord());
  });

  it("defaults candidates/reviewState when loading a record from before those fields existed", async () => {
    const legacy = {
      sourceLanguageCode: "en",
      sourceFile: { id: "src", languageCode: "en", filename: "en.lang", text: "key=Hello" },
      translatedFiles: [],
      minimumFrequency: 2,
      section: "review",
      savedAt: 1,
    } as unknown as TerminologyExtractionRecord;
    await saveTerminologyExtractionToIdb(legacy);
    const loaded = await loadTerminologyExtractionFromIdb();
    expect(loaded?.candidates).toEqual([]);
    expect(loaded?.reviewState).toEqual(emptyTerminologyReviewState());
  });

  it("overwrites the previous record on repeated saves", async () => {
    await saveTerminologyExtractionToIdb(sampleRecord());
    await saveTerminologyExtractionToIdb(sampleRecord({ minimumFrequency: 5, section: "merge" }));
    const loaded = await loadTerminologyExtractionFromIdb();
    expect(loaded?.minimumFrequency).toBe(5);
    expect(loaded?.section).toBe("merge");
  });

  it("clears the stored record", async () => {
    await saveTerminologyExtractionToIdb(sampleRecord());
    await clearTerminologyExtractionFromIdb();
    expect(await loadTerminologyExtractionFromIdb()).toBeNull();
  });
});
