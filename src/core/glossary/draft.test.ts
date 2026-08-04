// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  createGlossaryDraft,
  createGlossaryDraftEntry,
  glossaryDraftFromNormalized,
} from "./draft";
import { normalizeGlossary } from "./loader";

describe("glossary authoring drafts", () => {
  it("creates mutable drafts with safe schema defaults", () => {
    const draft = createGlossaryDraft({
      id: "necesse-bg",
      targetLanguage: "bg",
      entries: [{ source: "Settler", target: "Заселник" }],
    });

    draft.name = "Bulgarian glossary";
    draft.entries[0].forms.push("Заселникът");

    expect(draft).toMatchObject({
      format: "necesse-glossary",
      version: 1,
      name: "Bulgarian glossary",
      sourceLanguage: "en",
      targetLanguage: "bg",
      game: "Necesse",
    });
    expect(draft.entries[0]).toMatchObject({
      forms: ["Заселникът"],
      alternatives: [],
      forbidden: [],
      caseSensitive: false,
      wholeWord: true,
      status: "draft",
    });
  });

  it("deep-copies frozen runtime glossaries before editing", () => {
    const runtime = normalizeGlossary({
      format: "necesse-glossary",
      version: 1,
      id: "necesse-bg",
      name: "Bulgarian glossary",
      sourceLanguage: "en",
      targetLanguage: "bg",
      authors: ["Translator"],
      entries: [
        {
          source: "Settler",
          target: "Заселник",
          forms: ["Заселникът"],
        },
      ],
    });

    const draft = glossaryDraftFromNormalized(runtime);
    draft.authors.push("Reviewer");
    draft.entries[0].forms.push("Заселници");

    expect(runtime.authors).toEqual(["Translator"]);
    expect(runtime.entries[0].forms).toEqual(["Заселникът"]);
    expect(draft.authors).toEqual(["Translator", "Reviewer"]);
    expect(draft.entries[0].forms).toEqual(["Заселникът", "Заселници"]);
  });

  it("does not share array references with entry input", () => {
    const forms = ["Заселникът"];
    const entry = createGlossaryDraftEntry({ source: "Settler", target: "Заселник", forms });

    forms.push("Заселници");

    expect(entry.forms).toEqual(["Заселникът"]);
  });
});
