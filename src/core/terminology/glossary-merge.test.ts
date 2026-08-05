// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  applyTerminologyGlossaryMerge,
  planTerminologyGlossaryMerge,
  type MergeableGlossaryDocument,
} from "./glossary-merge";

const glossary: MergeableGlossaryDocument = {
  format: "necesse-glossary",
  version: 1,
  id: "necesse-bg",
  name: "Bulgarian",
  sourceLanguage: "en",
  targetLanguage: "bg",
  entries: [
    { source: "Damage", target: "Щети", note: "Keep metadata" },
    { source: "Armor", target: "Броня", wholeWord: false },
  ],
};

describe("planTerminologyGlossaryMerge", () => {
  it("classifies additions, identical entries and target conflicts", () => {
    const plan = planTerminologyGlossaryMerge(
      glossary,
      {
        targetLanguage: "bg",
        entries: [
          { source: "Damage", target: "Щети" },
          { source: "Health", target: "Здраве" },
          { source: "Damage", target: "Поражения" },
        ],
      },
      "en",
    );

    expect(plan).toEqual({
      compatibility: { compatible: true },
      additions: [{ source: "Health", target: "Здраве" }],
      updates: [],
      identical: [{ source: "Damage", target: "Щети" }],
      conflicts: [
        {
          incoming: { source: "Damage", target: "Поражения" },
          existing: [{ source: "Damage", target: "Щети", note: "Keep metadata" }],
        },
      ],
    });
  });

  it("treats different effective matching rules as separate entries", () => {
    const plan = planTerminologyGlossaryMerge(
      glossary,
      {
        targetLanguage: "bg",
        entries: [{ source: "Armor", target: "Броня" }],
      },
      "en",
    );

    expect(plan.additions).toEqual([{ source: "Armor", target: "Броня" }]);
    expect(plan.updates).toEqual([]);
    expect(plan.identical).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it("plans additive classified-value updates without overwriting entry metadata", () => {
    const plan = planTerminologyGlossaryMerge(
      glossary,
      {
        targetLanguage: "bg",
        entries: [
          {
            source: "Damage",
            target: "Щети",
            forms: ["Щетите"],
            alternatives: ["Поражения"],
            forbidden: ["Демидж"],
          },
        ],
      },
      "en",
    );

    expect(plan.additions).toEqual([]);
    expect(plan.identical).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.updates).toEqual([
      {
        incoming: {
          source: "Damage",
          target: "Щети",
          forms: ["Щетите"],
          alternatives: ["Поражения"],
          forbidden: ["Демидж"],
        },
        existing: { source: "Damage", target: "Щети", note: "Keep metadata" },
        merged: {
          source: "Damage",
          target: "Щети",
          note: "Keep metadata",
          forms: ["Щетите"],
          alternatives: ["Поражения"],
          forbidden: ["Демидж"],
        },
      },
    ]);
  });

  it("does not merge a value into incompatible classification groups", () => {
    const plan = planTerminologyGlossaryMerge(
      {
        ...glossary,
        entries: [
          {
            source: "Damage",
            target: "Щети",
            alternatives: ["Поражения"],
          },
        ],
      },
      {
        targetLanguage: "bg",
        entries: [
          {
            source: "Damage",
            target: "Щети",
            forbidden: ["Поражения"],
          },
        ],
      },
      "en",
    );

    expect(plan.updates).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
  });

  it("rejects source and target language mismatches", () => {
    expect(
      planTerminologyGlossaryMerge(glossary, { targetLanguage: "bg", entries: [] }, "de")
        .compatibility,
    ).toEqual({
      compatible: false,
      reason: "source-language",
      expected: "en",
      actual: "de",
    });

    expect(
      planTerminologyGlossaryMerge(glossary, { targetLanguage: "de", entries: [] }, "en")
        .compatibility,
    ).toEqual({
      compatible: false,
      reason: "target-language",
      expected: "bg",
      actual: "de",
    });
  });
});

describe("applyTerminologyGlossaryMerge", () => {
  it("appends only additions and preserves existing entries and metadata", () => {
    const plan = planTerminologyGlossaryMerge(
      glossary,
      {
        targetLanguage: "bg",
        entries: [
          { source: "Damage", target: "Поражения" },
          { source: "Health", target: "Здраве" },
        ],
      },
      "en",
    );

    const merged = applyTerminologyGlossaryMerge(glossary, plan);

    expect(merged).toEqual({
      ...glossary,
      entries: [
        { source: "Damage", target: "Щети", note: "Keep metadata" },
        { source: "Armor", target: "Броня", wholeWord: false },
        { source: "Health", target: "Здраве" },
      ],
    });
    expect(glossary.entries).toHaveLength(2);
  });

  it("does not mutate an incompatible glossary", () => {
    const plan = planTerminologyGlossaryMerge(
      glossary,
      {
        targetLanguage: "de",
        entries: [{ source: "Health", target: "Gesundheit" }],
      },
      "en",
    );

    expect(applyTerminologyGlossaryMerge(glossary, plan)).toEqual(glossary);
  });

  it("applies additions and additive classified-value updates together", () => {
    const plan = planTerminologyGlossaryMerge(
      glossary,
      {
        targetLanguage: "bg",
        entries: [
          { source: "Damage", target: "Щети", alternatives: ["Поражения"] },
          { source: "Health", target: "Здраве" },
        ],
      },
      "en",
    );

    expect(applyTerminologyGlossaryMerge(glossary, plan).entries).toEqual([
      {
        source: "Damage",
        target: "Щети",
        note: "Keep metadata",
        alternatives: ["Поражения"],
      },
      { source: "Armor", target: "Броня", wholeWord: false },
      { source: "Health", target: "Здраве" },
    ]);
  });
});
