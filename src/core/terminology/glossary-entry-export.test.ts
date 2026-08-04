// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import type { TerminologyReviewExport } from "./review-export";
import { buildTerminologyGlossaryEntryExport } from "./glossary-entry-export";

const review: TerminologyReviewExport = {
  format: "necesse-terminology-review",
  version: 1,
  sourceLanguageCode: "en",
  sourceFilename: "en.lang",
  generatedAt: "2026-08-04T00:00:00.000Z",
  candidates: [
    {
      source: "Damage",
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
        },
        {
          languageCode: "de",
          filename: "de.lang",
          preferredValue: "Schaden",
          observedVariants: ["Schaden"],
        },
      ],
      evidence: [],
    },
    {
      source: "Armor",
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
        },
      ],
      evidence: [],
    },
    {
      source: "Health",
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
        },
      ],
      evidence: [],
    },
    {
      source: "Mana",
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
        },
      ],
      evidence: [],
    },
  ],
};

describe("buildTerminologyGlossaryEntryExport", () => {
  it("converts only accepted reviewed candidates into minimal glossary entries", () => {
    expect(buildTerminologyGlossaryEntryExport(review, "2026-08-04T01:00:00.000Z")).toEqual({
      format: "necesse-glossary-entries",
      version: 1,
      sourceLanguage: "en",
      generatedAt: "2026-08-04T01:00:00.000Z",
      languages: [
        {
          targetLanguage: "bg",
          entries: [
            { source: "Armor", target: "Броня" },
            { source: "Damage", target: "Щети" },
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
            },
          ],
        },
      ],
    };

    expect(buildTerminologyGlossaryEntryExport(incomplete).languages).toEqual([]);
  });
});
