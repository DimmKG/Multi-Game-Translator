// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { validateGlossaryDocument } from "./validation";

function glossary(entries: unknown[]) {
  return {
    format: "necesse-glossary",
    version: 1,
    id: "necesse-bg",
    name: "Bulgarian glossary",
    sourceLanguage: "en",
    targetLanguage: "bg",
    game: "Necesse",
    authors: ["Translator"],
    entries,
  };
}

function codes(result: ReturnType<typeof validateGlossaryDocument>) {
  return result.problems.map((problem) => problem.code);
}

describe("shared glossary authoring validation", () => {
  it("accepts a complete glossary without warnings", () => {
    const result = validateGlossaryDocument(
      glossary([
        {
          source: "Settler",
          target: "Заселник",
          status: "approved",
          category: "character",
        },
      ]),
    );

    expect(result).toEqual({ valid: true, errors: [], warnings: [], problems: [] });
  });

  it("reports blocking document and entry errors with stable paths", () => {
    const result = validateGlossaryDocument({
      format: "other",
      version: 2,
      id: "Bad ID",
      name: "",
      sourceLanguage: "english",
      targetLanguage: "",
      authors: ["Translator", "Translator"],
      entries: [{ source: "", target: "", status: "unknown", caseSensitive: "yes" }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((problem) => [problem.code, problem.path])).toEqual(
      expect.arrayContaining([
        ["unsupported-format", "format"],
        ["unsupported-version", "version"],
        ["invalid-id", "id"],
        ["name-required", "name"],
        ["invalid-source-language", "sourceLanguage"],
        ["invalid-target-language", "targetLanguage"],
        ["duplicate-author", "authors[1]"],
        ["source-required", "entries[0].source"],
        ["target-required", "entries[0].target"],
        ["unsupported-status", "entries[0].status"],
        ["boolean-invalid", "entries[0].caseSensitive"],
      ]),
    );
  });

  it("blocks duplicate array values and preferred-forbidden conflicts", () => {
    const result = validateGlossaryDocument(
      glossary([
        {
          source: "Settler",
          target: "Заселник",
          alternatives: ["Колонист", "Колонист"],
          forbidden: ["заселник"],
          status: "approved",
          category: "character",
        },
      ]),
    );

    expect(codes(result)).toEqual(
      expect.arrayContaining(["array-duplicate-value", "preferred-forbidden-conflict"]),
    );
    expect(result.valid).toBe(false);
  });

  it("distinguishes ambiguous matches from redundant duplicates", () => {
    const ambiguous = validateGlossaryDocument(
      glossary([
        { source: "Settler", target: "Заселник", category: "character" },
        { source: "settler", target: "Колонист", category: "character" },
      ]),
    );
    const redundant = validateGlossaryDocument(
      glossary([
        { source: "Settler", target: "Заселник", category: "character" },
        { source: "settler", target: "Заселник", category: "character" },
      ]),
    );

    expect(codes(ambiguous)).toContain("ambiguous-duplicate-entry");
    expect(ambiguous.valid).toBe(false);
    expect(codes(redundant)).toContain("duplicate-entry");
    expect(redundant.valid).toBe(true);
  });

  it("reports non-blocking authoring warnings", () => {
    const result = validateGlossaryDocument({
      ...glossary([
        {
          source: "A",
          target: "a",
          alternatives: ["Allowed"],
          forbidden: ["allowed"],
          wholeWord: false,
          status: "context-dependent",
        },
      ]),
      authors: [],
    });

    expect(result.valid).toBe(true);
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        "missing-authors",
        "source-target-identical",
        "alternative-forbidden-overlap",
        "one-character-source",
        "short-non-whole-word",
        "missing-category",
        "context-dependent-missing-context",
      ]),
    );
  });

  it("warns when duplicate sources depend on different context", () => {
    const result = validateGlossaryDocument(
      glossary([
        {
          source: "Charge",
          target: "Заряд",
          context: "resource",
          category: "resource",
        },
        {
          source: "Charge",
          target: "Атака",
          context: "combat action",
          category: "action",
          caseSensitive: true,
        },
      ]),
    );

    expect(codes(result)).toContain("duplicate-source-context");
  });
});
