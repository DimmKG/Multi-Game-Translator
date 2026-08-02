import test from "node:test";
import assert from "node:assert/strict";
import { containsGlossaryTerm, inspectTerminology, stripProtectedTokens } from "../src/scripts/glossary/matcher.js";

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
      status: "approved"
    }
  ]
};

test("whole-word matching does not match inside a longer word", () => {
  assert.equal(containsGlossaryTerm("A Caveling appears", "Caveling", { wholeWord: true }), true);
  assert.equal(containsGlossaryTerm("Cavelings", "Caveling", { wholeWord: true }), false);
  assert.equal(containsGlossaryTerm("Cavelings", "Caveling", { wholeWord: false }), true);
});

test("matching is case-insensitive by default", () => {
  assert.equal(containsGlossaryTerm("CAVELING", "Caveling", {}), true);
  assert.equal(containsGlossaryTerm("CAVELING", "Caveling", { caseSensitive: true }), false);
});

test("protected placeholders and references are removed before matching", () => {
  assert.equal(stripProtectedTokens("Talk to <settler> and [item=Settler]"), "Talk to   and  ");
  assert.equal(containsGlossaryTerm("Talk to <settler>", "Settler", {}), false);
  assert.equal(containsGlossaryTerm("Use [item=Settler]", "Settler", {}), false);
  assert.equal(containsGlossaryTerm("The Settler arrives", "Settler", {}), true);
});

test("placeholder-only source text does not trigger terminology QA", () => {
  const settlerGlossary = {
    id: "settler-test",
    name: "Settler test",
    entries: [{
      source: "Settler",
      target: "Заселник",
      forms: ["Заселникът", "Заселника", "Заселници", "Заселниците"],
      alternatives: [],
      forbidden: [],
      caseSensitive: false,
      wholeWord: true,
      status: "approved"
    }]
  };
  assert.deepEqual(inspectTerminology("Give this to <settler>", "Дай това на <settler>", [settlerGlossary]), []);
});

test("forbidden terms inside protected target tokens are ignored", () => {
  assert.deepEqual(inspectTerminology("A Caveling appears", "Появява се <Пещерняк>", [glossary]).map(issue => issue.type), ["missing-preferred"]);
});

test("preferred target satisfies the glossary rule", () => {
  assert.deepEqual(inspectTerminology("A Caveling appears", "Появява се Пещерник", [glossary]), []);
});

test("a grammatical form satisfies the glossary rule", () => {
  assert.deepEqual(inspectTerminology("The Caveling arrives", "Пещерникът пристига", [glossary]), []);
  assert.deepEqual(inspectTerminology("Defeat the Caveling", "Победи Пещерника", [glossary]), []);
});

test("an allowed alternative satisfies the glossary rule", () => {
  assert.deepEqual(inspectTerminology("A Caveling appears", "Появява се подземно същество", [glossary]), []);
});

test("missing preferred terminology exposes accepted forms", () => {
  const issues = inspectTerminology("A Caveling appears", "Появява се същество", [glossary]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "missing-preferred");
  assert.equal(issues[0].preferred, "Пещерник");
  assert.deepEqual(issues[0].forms, glossary.entries[0].forms);
});

test("forbidden terminology produces both forbidden and missing issues", () => {
  const issues = inspectTerminology("A Caveling appears", "Появява се Пещерняк", [glossary]);
  assert.deepEqual(issues.map(issue => issue.type), ["forbidden", "missing-preferred"]);
});

test("deprecated entries are ignored", () => {
  const deprecated = { ...glossary, entries: [{ ...glossary.entries[0], status: "deprecated" }] };
  assert.deepEqual(inspectTerminology("A Caveling appears", "Пещерняк", [deprecated]), []);
});

test("entries are checked only when their source term appears", () => {
  assert.deepEqual(inspectTerminology("A farmer appears", "Пещерняк", [glossary]), []);
});
