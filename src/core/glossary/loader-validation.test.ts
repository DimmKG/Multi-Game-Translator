// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { normalizeGlossary } from "./loader";

function glossary(entry: Record<string, unknown>) {
  return {
    format: "necesse-glossary",
    version: 1,
    id: "necesse-bg",
    name: "Bulgarian glossary",
    sourceLanguage: "en",
    targetLanguage: "bg",
    authors: ["Translator"],
    entries: [entry],
  };
}

describe("glossary import validation", () => {
  it("uses the shared blocking authoring rules", () => {
    expect(() =>
      normalizeGlossary(
        glossary({
          source: "Settler",
          target: "Заселник",
          forbidden: ["заселник"],
          category: "character",
        }),
      ),
    ).toThrow(/preferred-forbidden-conflict/);
  });

  it("allows warnings while preserving runtime normalization", () => {
    expect(
      normalizeGlossary(
        glossary({
          source: "Settler",
          target: "Заселник",
        }),
      ),
    ).toMatchObject({
      entries: [{ source: "Settler", target: "Заселник", category: "" }],
    });
  });
});
