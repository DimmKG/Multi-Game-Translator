// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import type { TerminologyCandidate } from "./extract-candidates";
import { buildTerminologyReviewExport } from "./review-export";

const candidate: TerminologyCandidate = {
  source: "Iron Bar",
  sourceFrequency: 2,
  sourceKeys: ["ironbar", "ironbar_tip"],
  sections: ["items"],
  languages: [
    {
      languageCode: "bg",
      filename: "bg.lang",
      matchedCount: 2,
      variants: [
        {
          value: "Желязно кюлче",
          count: 2,
          ratio: 1,
          evidenceKeys: ["ironbar", "ironbar_tip"],
        },
      ],
      dominantVariant: "Желязно кюлче",
      dominantRatio: 1,
      hasConflict: false,
    },
  ],
  evidence: [
    {
      key: "ironbar",
      section: "items",
      source: "Iron Bar",
      target: "Желязно кюлче",
    },
  ],
};

const sourceFile = {
  languageCode: "en",
  filename: "en.lang",
  text: "[items]\nironbar=Iron Bar\nironbar_tip=Iron Bar\n",
};

describe("terminology review export", () => {
  it("exports explicit decisions with preferred and observed values", () => {
    const exported = buildTerminologyReviewExport(
      sourceFile,
      [candidate],
      {
        decisions: { "Iron Bar": "accepted" },
        preferredVariants: { "Iron Bar": { bg: "Желязно кюлче" } },
      },
      "2026-08-04T00:00:00.000Z",
    );

    expect(exported).toMatchObject({
      format: "necesse-terminology-review",
      version: 1,
      sourceLanguageCode: "en",
      sourceFilename: "en.lang",
      generatedAt: "2026-08-04T00:00:00.000Z",
    });
    expect(exported.candidates).toEqual([
      expect.objectContaining({
        source: "Iron Bar",
        decision: "accepted",
        languages: [
          {
            languageCode: "bg",
            filename: "bg.lang",
            preferredValue: "Желязно кюлче",
            observedVariants: ["Желязно кюлче"],
          },
        ],
      }),
    ]);
  });

  it("omits pending and incomplete accepted candidates", () => {
    expect(
      buildTerminologyReviewExport(sourceFile, [candidate], {
        decisions: {},
        preferredVariants: {},
      }).candidates,
    ).toEqual([]);

    expect(
      buildTerminologyReviewExport(sourceFile, [candidate], {
        decisions: { "Iron Bar": "accepted" },
        preferredVariants: {},
      }).candidates,
    ).toEqual([]);
  });

  it("keeps rejected and needs-review candidates even without preferred values", () => {
    const exported = buildTerminologyReviewExport(sourceFile, [candidate], {
      decisions: { "Iron Bar": "needs-review" },
      preferredVariants: {},
    });

    expect(exported.candidates[0]).toMatchObject({
      source: "Iron Bar",
      decision: "needs-review",
      languages: [{ preferredValue: null }],
    });
  });
});
