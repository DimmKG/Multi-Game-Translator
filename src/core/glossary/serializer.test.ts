// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { createGlossaryDraft } from "./draft";
import { normalizeGlossary } from "./loader";
import {
  buildGlossaryExportDocument,
  GlossaryDraftValidationError,
  serializeGlossaryDraft,
} from "./serializer";

function validDraft() {
  return createGlossaryDraft({
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
        status: "approved",
        category: "character",
      },
    ],
  });
}

describe("deterministic glossary draft serialization", () => {
  it("produces stable schema-compatible JSON from explicit boundary metadata", () => {
    const draft = validDraft();

    const first = serializeGlossaryDraft(draft, "2026-08-04");
    const second = serializeGlossaryDraft(draft, "2026-08-04");
    const parsed = JSON.parse(first);

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(Object.keys(parsed)).toEqual([
      "format",
      "version",
      "id",
      "name",
      "sourceLanguage",
      "targetLanguage",
      "game",
      "authors",
      "updatedAt",
      "entries",
    ]);
    expect(normalizeGlossary(parsed)).toMatchObject({
      id: "necesse-bg",
      updatedAt: "2026-08-04",
      entries: [{ source: "Settler", target: "Заселник" }],
    });
  });

  it("does not mutate draft dates or nested arrays", () => {
    const draft = validDraft();

    const exported = buildGlossaryExportDocument(draft, "2026-08-04");
    exported.entries[0].forms?.push("Заселници");

    expect(draft.updatedAt).toBe("");
    expect(draft.entries[0].forms).toEqual(["Заселникът"]);
  });

  it("blocks invalid drafts and invalid export dates", () => {
    const draft = validDraft();
    draft.entries[0].target = "";

    expect(() => serializeGlossaryDraft(draft, "2026-08-04")).toThrow(GlossaryDraftValidationError);
    expect(() => serializeGlossaryDraft(validDraft(), "04/08/2026")).toThrow(
      GlossaryDraftValidationError,
    );
  });
});
