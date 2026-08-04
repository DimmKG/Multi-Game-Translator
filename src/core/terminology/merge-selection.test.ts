// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { chooseTerminologyMergeTarget, compatibleTerminologyGlossaries } from "./merge-selection";

const glossaries = [
  { id: "bg", sourceLanguage: "en", targetLanguage: "bg" },
  { id: "de", sourceLanguage: "en", targetLanguage: "de" },
  { id: "wrong-source", sourceLanguage: "fr", targetLanguage: "bg" },
];

describe("terminology merge target selection", () => {
  it("keeps only loaded glossaries compatible with the reviewed languages", () => {
    expect(
      compatibleTerminologyGlossaries(glossaries, "EN", new Set(["bg"])).map(
        (glossary) => glossary.id,
      ),
    ).toEqual(["bg"]);
  });

  it("auto-selects the only compatible glossary", () => {
    expect(chooseTerminologyMergeTarget("", ["bg"])).toBe("bg");
    expect(chooseTerminologyMergeTarget("bg", ["bg", "de"])).toBe("bg");
  });

  it("requires an explicit choice when several compatible targets exist", () => {
    expect(chooseTerminologyMergeTarget("missing", ["bg", "de"])).toBe("");
    expect(chooseTerminologyMergeTarget("", [])).toBe("");
  });
});
