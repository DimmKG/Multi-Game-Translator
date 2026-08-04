// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import type { TerminologyReviewExport } from "./review-export";
import { buildTerminologyGlossaryEntryExport } from "./glossary-entry-export";

const review: TerminologyReviewExport = {
  format: "necesse-terminology-review",
  version: 2,
  sourceLanguageCode: "en",
  sourceFilename: "en.lang",
  generatedAt: "2026-08-04T00:00:00.000Z",
  candidates: [
    {
      source: "Damage",
      entrySource: "Damage",
      candidateKind: "term",
      decision: "accepted",
      sourceFrequency: 3,
      sourceKeys: ["a", "b", "c"],
      sections: ["items"],
      languages: [
        {
          languageCode: "bg",
          filename: "bg.lang",
          preferredValue: " Щети ",
          observedVariants: ["Щети", "Поражения"],
          classifiedValues: {
            forms: ["Щетите"],
            alternatives: ["Поражения"],
            forbidden: ["Демидж"],
          },
        },
        {
          languageCode: "de",
          filename: "de.lang",
          preferredValue: "Schaden",
          observedVariants: ["Schaden"],
          classifiedValues: { forms: [], alternatives: [], forbidden: [] },
        },
      ],
      evidence: [],
    },
    {
      source: "Armor",
      entrySource: "Armour",
      candidateKind: "term",
      decision: "accepted",
      sourceFrequency: 2,
      sourceKeys: ["d", "e"],
      sections: ["items"],
      languages: [
        {
          languageCode: "bg",
          filename: "bg.lang",
          preferredValue: "Броня",
          observedVariants: ["Броня"],
          classifiedValues: { forms: [], alternatives: [], forbidden: [] },
        },
      ],
      evidence: [],
    },
    {
      source: "Health",
      entrySource: "Health",
      candidateKind: "term",
      decision: "needs-review",
      sourceFrequency: 2,
      sourceKeys: ["f", "g"],
      sections: ["ui"],
      languages: [
        {
          languageCode: "bg",
          filename: "bg.lang",
          preferredValue: "Здраве",
          observedVariants: ["Здраве"],
          classifiedValues: { forms: [], alternatives: [], forbidden: [] },
        },
      ],
      evidence: [],
    },
    {
      source: "Mana",
      entrySource: "Mana",
      candidateKind: "term",
      decision: "rejected",
      sourceFrequency: 2,
      sourceKeys: ["h", "i"],
      sections: ["ui"],
      languages: [
        {
          languageCode: "bg",
          filename: "bg.lang",
          preferredValue: "Мана",
          observedVariants: ["Мана"],
          classifiedValues: { forms: [], alternatives: [], forbidden: [] },
        },
      ],
      evidence: [],
    },
  ],
};

describe("buildTerminologyGlossaryEntryExport", () => {
  it("converts only accepted reviewed candidates into classified glossary entries", () => {
    expect(buildTerminologyGlossaryEntryExport(review, "2026-08-04T01:00:00.000Z")).toEqual({
      format: "necesse-glossary-entries",
      version: 1,
      sourceLanguage: "en",
      generatedAt: "2026-08-04T01:00:00.000Z",
      languages: [
        {
          targetLanguage: "bg",
          entries: [
            { source: "Armour", target: "Броня" },
            {
              source: "Damage",
              target: "Щети",
              forms: ["Щетите"],
              alternatives: ["Поражения"],
              forbidden: ["Демидж"],
            },
          ],
        },
        {
          targetLanguage: "de",
          entries: [{ source: "Damage", target: "Schaden" }],
        },
      ],
    });
  });

  it("omits empty preferred values and languages without entries", () => {
    const incomplete: TerminologyReviewExport = {
      ...review,
      candidates: [
        {
          ...review.candidates[0],
          languages: [
            {
              languageCode: "bg",
              filename: "bg.lang",
              preferredValue: "   ",
              observedVariants: ["Щети"],
              classifiedValues: { forms: [], alternatives: [], forbidden: [] },
            },
          ],
        },
      ],
    };

    expect(buildTerminologyGlossaryEntryExport(incomplete).languages).toEqual([]);
  });
});
