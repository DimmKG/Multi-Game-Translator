// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  buildTerminologyCandidateExport,
  extractTerminologyCandidates,
  type TerminologyCorpusFile,
} from "./extract-candidates";

const source: TerminologyCorpusFile = {
  languageCode: "en",
  filename: "en.lang",
  text: [
    "[combat]",
    "damage_label=Damage",
    "damage_tooltip=Damage",
    "charge_label=Charge",
    "charge_cost=Charge",
    "placeholder_only=<name>",
    "number_only=123",
    "single=Settlement",
  ].join("\n"),
};

const bulgarian: TerminologyCorpusFile = {
  languageCode: "bg",
  filename: "bg.lang",
  text: [
    "[combat]",
    "damage_label=Щети",
    "damage_tooltip=Щети",
    "charge_label=Заряд",
    "charge_cost=Такса",
    "placeholder_only=<name>",
    "number_only=123",
    "single=Селище",
  ].join("\n"),
};

const german: TerminologyCorpusFile = {
  languageCode: "de",
  filename: "de.lang",
  text: [
    "[combat]",
    "damage_label=Schaden",
    "damage_tooltip=Schaden",
    "charge_label=Ladung",
    "MISSING_TRANSLATION:charge_cost=Charge",
  ].join("\n"),
};

describe("extractTerminologyCandidates", () => {
  it("groups repeated source text and aligns translations strictly by key", () => {
    const candidates = extractTerminologyCandidates(source, [bulgarian, german]);

    expect(candidates.map((candidate) => candidate.source)).toEqual(["Charge", "Damage"]);

    const damage = candidates.find((candidate) => candidate.source === "Damage");
    expect(damage).toMatchObject({
      sourceFrequency: 2,
      sourceKeys: ["damage_label", "damage_tooltip"],
      sections: ["[combat]"],
    });
    expect(damage?.languages[0]).toMatchObject({
      languageCode: "bg",
      matchedCount: 2,
      dominantVariant: "Щети",
      dominantRatio: 1,
      hasConflict: false,
    });
  });

  it("reports conflicting target variants and their evidence", () => {
    const charge = extractTerminologyCandidates(source, [bulgarian, german]).find(
      (candidate) => candidate.source === "Charge",
    );

    expect(charge?.languages[0]).toMatchObject({
      languageCode: "bg",
      matchedCount: 2,
      dominantRatio: 0.5,
      hasConflict: true,
    });
    expect(charge?.languages[0].variants).toEqual([
      { value: "Заряд", count: 1, ratio: 0.5, evidenceKeys: ["charge_label"] },
      { value: "Такса", count: 1, ratio: 0.5, evidenceKeys: ["charge_cost"] },
    ]);

    expect(charge?.languages[1]).toMatchObject({
      languageCode: "de",
      matchedCount: 1,
      dominantVariant: "Ladung",
      dominantRatio: 1,
      hasConflict: false,
    });
  });

  it("can include single occurrences explicitly", () => {
    const candidates = extractTerminologyCandidates(source, [bulgarian], {
      includeSingleOccurrences: true,
    });

    expect(candidates.some((candidate) => candidate.source === "Settlement")).toBe(true);
    expect(candidates.some((candidate) => candidate.source === "<name>")).toBe(false);
    expect(candidates.some((candidate) => candidate.source === "123")).toBe(false);
  });

  it("excludes sentences, tokenized values, and overlong phrases", () => {
    const noisySource: TerminologyCorpusFile = {
      languageCode: "en",
      filename: "en.lang",
      text: [
        "term_one=Ancient Fossil Fragment",
        "term_two=Ancient Fossil Fragment",
        "sentence_one=This is a complete sentence.",
        "sentence_two=This is a complete sentence.",
        "placeholder_one=Hello <name>",
        "placeholder_two=Hello <name>",
        "format_one=§bDamage",
        "format_two=§bDamage",
        "long_one=One two three four five six seven",
        "long_two=One two three four five six seven",
      ].join("\n"),
    };
    const noisyTarget: TerminologyCorpusFile = {
      languageCode: "bg",
      filename: "bg.lang",
      text: [
        "term_one=Древен фосилен фрагмент",
        "term_two=Древен фосилен фрагмент",
        "sentence_one=Това е цяло изречение.",
        "sentence_two=Това е цяло изречение.",
        "placeholder_one=Здравей, <name>",
        "placeholder_two=Здравей, <name>",
        "format_one=§bЩети",
        "format_two=§bЩети",
        "long_one=Едно две три четири пет шест седем",
        "long_two=Едно две три четири пет шест седем",
      ].join("\n"),
    };

    const candidates = extractTerminologyCandidates(noisySource, [noisyTarget]);

    expect(candidates.map((candidate) => candidate.source)).toEqual(["Ancient Fossil Fragment"]);
  });

  it("builds a stable versioned export envelope", () => {
    const candidates = extractTerminologyCandidates(source, [bulgarian]);
    const exported = buildTerminologyCandidateExport(
      source,
      candidates,
      "2026-08-03T07:00:00.000Z",
    );

    expect(exported).toMatchObject({
      format: "necesse-terminology-candidates",
      version: 1,
      sourceLanguageCode: "en",
      sourceFilename: "en.lang",
      generatedAt: "2026-08-03T07:00:00.000Z",
    });
  });
});
