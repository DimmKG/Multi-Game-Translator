// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import type { TerminologyCandidate } from "./extract-candidates";
import { buildTerminologyReviewExport } from "./review-export";
import { emptyTerminologyReviewState } from "./review-state";

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
        ...emptyTerminologyReviewState(),
        decisions: { "Iron Bar": "accepted" },
        candidateKinds: { "Iron Bar": "phrase" },
        preferredVariants: { "Iron Bar": { bg: "Желязно кюлче" } },
        variantClassifications: {
          "Iron Bar": { bg: { "Железен слитък": "alternative" } },
        },
      },
      "2026-08-04T00:00:00.000Z",
    );

    expect(exported).toMatchObject({
      format: "necesse-terminology-review",
      version: 2,
      sourceLanguageCode: "en",
      sourceFilename: "en.lang",
      generatedAt: "2026-08-04T00:00:00.000Z",
    });
    expect(exported.candidates).toEqual([
      expect.objectContaining({
        source: "Iron Bar",
        entrySource: "Iron Bar",
        candidateKind: "phrase",
        decision: "accepted",
        languages: [
          {
            languageCode: "bg",
            filename: "bg.lang",
            preferredValue: "Желязно кюлче",
            observedVariants: ["Желязно кюлче"],
            classifiedValues: {
              forms: [],
              alternatives: ["Железен слитък"],
              forbidden: [],
            },
          },
        ],
      }),
    ]);
  });

  it("omits pending and incomplete accepted candidates", () => {
    expect(
      buildTerminologyReviewExport(sourceFile, [candidate], {
        ...emptyTerminologyReviewState(),
        decisions: {},
      }).candidates,
    ).toEqual([]);

    expect(
      buildTerminologyReviewExport(sourceFile, [candidate], {
        ...emptyTerminologyReviewState(),
        decisions: { "Iron Bar": "accepted" },
      }).candidates,
    ).toEqual([]);
  });

  it("keeps rejected and needs-review candidates even without preferred values", () => {
    const exported = buildTerminologyReviewExport(sourceFile, [candidate], {
      ...emptyTerminologyReviewState(),
      decisions: { "Iron Bar": "needs-review" },
    });

    expect(exported.candidates[0]).toMatchObject({
      source: "Iron Bar",
      entrySource: "Iron Bar",
      candidateKind: null,
      decision: "needs-review",
      languages: [
        {
          preferredValue: null,
          classifiedValues: { forms: [], alternatives: [], forbidden: [] },
        },
      ],
    });
  });

  it("keeps sentence-like evidence but never exports it as an accepted candidate", () => {
    const exported = buildTerminologyReviewExport(sourceFile, [candidate], {
      ...emptyTerminologyReviewState(),
      decisions: { "Iron Bar": "accepted" },
      candidateKinds: { "Iron Bar": "sentence-like" },
      preferredVariants: { "Iron Bar": { bg: "Желязно кюлче" } },
    });

    expect(exported.candidates).toEqual([]);
  });
});
