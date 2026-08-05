// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { createGlossaryDraftEntry } from "./draft";
import { glossaryDraftEntrySearchText, glossaryValuesFromMultiline } from "./authoring-editor";

describe("glossary authoring editor helpers", () => {
  it("preserves classified values and protected tokens exactly", () => {
    expect(glossaryValuesFromMultiline("Заселникът\n <name> \n${player}\n\nЗаселници")).toEqual([
      "Заселникът",
      " <name> ",
      "${player}",
      "Заселници",
    ]);
  });

  it("searches every editable entry field", () => {
    const entry = createGlossaryDraftEntry({
      source: "Settler",
      target: "Заселник",
      forms: ["Заселници"],
      alternatives: ["Колонист"],
      forbidden: ["Преселник"],
      status: "approved",
      category: "character",
      context: "Settlement population",
      note: "Use consistently",
    });
    const searchable = glossaryDraftEntrySearchText(entry);

    for (const value of [
      "settler",
      "заселник",
      "заселници",
      "колонист",
      "преселник",
      "approved",
      "character",
      "population",
      "consistently",
    ]) {
      expect(searchable).toContain(value);
    }
  });
});
