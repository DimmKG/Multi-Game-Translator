// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { containsGlossaryTerm, inspectTerminology, stripProtectedTokens } from "./matcher";

const glossary = {
  id: "bg-test",
  name: "Bulgarian test glossary",
  entries: [
    {
      source: "Caveling",
      target: "Пещерник",
      forms: ["Пещерникът", "Пещерника", "Пещерници", "Пещерниците"],
      alternatives: ["Подземно същество"],
      forbidden: ["Пещерняк"],
      caseSensitive: false,
      wholeWord: true,
      status: "approved",
    },
  ],
};

describe("glossary matcher", () => {
  it("whole-word matching does not match inside a longer word", () => {
    expect(containsGlossaryTerm("A Caveling appears", "Caveling", { wholeWord: true })).toBe(true);
    expect(containsGlossaryTerm("Cavelings", "Caveling", { wholeWord: true })).toBe(false);
    expect(containsGlossaryTerm("Cavelings", "Caveling", { wholeWord: false })).toBe(true);
  });

  it("matching is case-insensitive by default", () => {
    expect(containsGlossaryTerm("CAVELING", "Caveling", {})).toBe(true);
    expect(containsGlossaryTerm("CAVELING", "Caveling", { caseSensitive: true })).toBe(false);
  });

  it("protected placeholders and references are removed before matching", () => {
    expect(stripProtectedTokens("Talk to <settler> and [item=Settler]")).toBe("Talk to   and  ");
    expect(containsGlossaryTerm("Talk to <settler>", "Settler", {})).toBe(false);
    expect(containsGlossaryTerm("Use [item=Settler]", "Settler", {})).toBe(false);
    expect(containsGlossaryTerm("The Settler arrives", "Settler", {})).toBe(true);
  });

  it("placeholder-only source text does not trigger terminology QA", () => {
    const settlerGlossary = {
      id: "settler-test",
      name: "Settler test",
      entries: [
        {
          source: "Settler",
          target: "Заселник",
          forms: ["Заселникът", "Заселника", "Заселници", "Заселниците"],
          alternatives: [],
          forbidden: [],
          caseSensitive: false,
          wholeWord: true,
          status: "approved",
        },
      ],
    };
    expect(
      inspectTerminology("Give this to <settler>", "Дай това на <settler>", [settlerGlossary]),
    ).toEqual([]);
  });

  it("forbidden terms inside protected target tokens are ignored", () => {
    expect(
      inspectTerminology("A Caveling appears", "Появява се <Пещерняк>", [glossary]).map(
        (issue) => issue.type,
      ),
    ).toEqual(["missing-preferred"]);
  });

  it("preferred target satisfies the glossary rule", () => {
    expect(inspectTerminology("A Caveling appears", "Появява се Пещерник", [glossary])).toEqual([]);
  });

  it("a grammatical form satisfies the glossary rule", () => {
    expect(inspectTerminology("The Caveling arrives", "Пещерникът пристига", [glossary])).toEqual(
      [],
    );
    expect(inspectTerminology("Defeat the Caveling", "Победи Пещерника", [glossary])).toEqual([]);
  });

  it("an allowed alternative satisfies the glossary rule", () => {
    expect(
      inspectTerminology("A Caveling appears", "Появява се подземно същество", [glossary]),
    ).toEqual([]);
  });

  it("missing preferred terminology exposes accepted forms", () => {
    const issues = inspectTerminology("A Caveling appears", "Появява се същество", [glossary]);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("missing-preferred");
    expect(issues[0].preferred).toBe("Пещерник");
    expect(issues[0].forms).toEqual(glossary.entries[0].forms);
  });

  it("forbidden wording produces a forbidden issue", () => {
    const issues = inspectTerminology("A Caveling appears", "Появява се Пещерняк", [glossary]);
    expect(issues.some((issue) => issue.type === "forbidden")).toBe(true);
  });
});
