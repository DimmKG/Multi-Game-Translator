// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { extractTerminologyCandidates, type TerminologyCorpusFile } from "./extract-candidates";

function corpus(languageCode: string, filename: string, lines: string[]): TerminologyCorpusFile {
  return { languageCode, filename, text: lines.join("\n") };
}

describe("extractTerminologyCandidates phrase-family integration", () => {
  it("extracts repeated sentence subjects without promoting full descriptions", () => {
    const candidates = extractTerminologyCandidates(
      corpus("en", "en.lang", [
        "seedheal=Seed Launcher restores health on hit",
        "seedrange=Seed Launcher has increased speed and range",
        "dreamcatchertip=Increases mana regen by 100%",
        "peglegobtain=Dropped from Pirates",
      ]),
      [
        corpus("bg", "bg.lang", [
          "seedheal=Семенострелът възстановява здраве при попадение",
          "seedrange=Семенострелът има по-висока скорост и далечина",
          "dreamcatchertip=Увеличава регенерацията на мана със 100%",
          "peglegobtain=Пада от пирати",
        ]),
      ],
    );

    const seedLauncher = candidates.find((candidate) => candidate.source === "Seed Launcher");
    expect(seedLauncher?.languages[0].variants.map((variant) => variant.value)).toEqual([
      "Семенострелът",
    ]);
    expect(seedLauncher?.evidence.map((item) => item.source)).toEqual([
      "Seed Launcher restores health on hit",
      "Seed Launcher has increased speed and range",
    ]);

    expect(candidates.some((candidate) => candidate.source.includes("mana regen"))).toBe(false);
    expect(candidates.some((candidate) => candidate.source === "Dropped from Pirates")).toBe(false);
  });

  it("does not fall back to whole target rows when one language cannot align a family", () => {
    const candidates = extractTerminologyCandidates(
      corpus("en", "en.lang", [
        "seedheal=Seed Launcher restores health on hit",
        "seedrange=Seed Launcher has increased speed and range",
      ]),
      [
        corpus("bg", "bg.lang", [
          "seedheal=Семенострелът възстановява здраве при попадение",
          "seedrange=Семенострелът има по-висока скорост и далечина",
        ]),
        corpus("de", "de.lang", [
          "seedheal=Heilt bei einem Treffer mit dem Saatwerfer",
          "seedrange=Mehr Geschwindigkeit und Reichweite für den Saatwerfer",
        ]),
      ],
    );

    const seedLauncher = candidates.find((candidate) => candidate.source === "Seed Launcher");
    expect(seedLauncher?.languages[0].dominantVariant).toBe("Семенострелът");
    expect(seedLauncher?.languages[1]).toMatchObject({
      matchedCount: 0,
      variants: [],
      dominantVariant: null,
    });
  });

  it("rejects unanchored lowercase fragments and token-bearing families", () => {
    const candidates = extractTerminologyCandidates(
      corpus("en", "en.lang", [
        "deathone=<victim> was slain by <attacker>",
        "deathtwo=<victim> was burned by <attacker>",
        "roomone=My room is completely dark",
        "roomtwo=My room has no floor",
        "seedfire=[input=fire] Seed Launcher fires rapidly",
        "seedheal=[input=heal] Seed Launcher restores health",
        "woodgate=Wood Fence Gate",
        "stonegate=Stone Fence Gate",
        "patchbase=Patch notes",
        "patchlink=See patch notes",
      ]),
      [
        corpus("bg", "bg.lang", [
          "deathone=<victim> бе повален от <attacker>",
          "deathtwo=<victim> бе изгорен от <attacker>",
          "roomone=Стаята ми е напълно тъмна",
          "roomtwo=Стаята ми няма под",
          "seedfire=[input=fire] Семенострелът стреля бързо",
          "seedheal=[input=heal] Семенострелът възстановява здраве",
          "woodgate=Порта на дървена ограда",
          "stonegate=Порта на каменна ограда",
          "patchbase=Бележки към актуализацията",
          "patchlink=Виж бележките към актуализацията",
        ]),
      ],
    );

    expect(candidates.some((candidate) => candidate.source === "by attacker")).toBe(false);
    expect(candidates.some((candidate) => candidate.source === "My room")).toBe(false);
    expect(candidates.some((candidate) => candidate.source === "Seed Launcher")).toBe(false);
    expect(candidates.some((candidate) => candidate.source === "Fence Gate")).toBe(false);
    expect(candidates.some((candidate) => candidate.source === "Patch notes")).toBe(true);
  });

  it("extracts a base term across word order without promoting one-off modifiers", () => {
    const candidates = extractTerminologyCandidates(
      corpus("en", "en.lang", [
        "base=Alchemical Workstation",
        "abyssal=Abyssal Alchemical Workstation",
        "fallen=Fallen Alchemical Workstation",
      ]),
      [
        corpus("bg", "bg.lang", [
          "base=Алхимичен тезгях",
          "abyssal=Алхимичен тезгях на Бездната",
          "fallen=Алхимичен тезгях на Падналите",
        ]),
      ],
    );

    expect(
      candidates.map((candidate) => [candidate.source, candidate.languages[0].dominantVariant]),
    ).toEqual([["Alchemical Workstation", "Алхимичен тезгях"]]);
  });

  it("aligns duplicate keys by occurrence instead of overwriting them", () => {
    const candidates = extractTerminologyCandidates(
      corpus("en", "en.lang", ["patchnotes=See patch notes", "patchnotes=Patch notes"]),
      [
        corpus("bg", "bg.lang", [
          "patchnotes=Виж бележките към актуализацията",
          "patchnotes=Бележки към актуализацията",
        ]),
      ],
    );

    const patchNotes = candidates.find(
      (candidate) => candidate.source.toLocaleLowerCase() === "patch notes",
    );
    expect(patchNotes?.evidence).toHaveLength(2);
    expect(patchNotes?.languages[0].matchedCount).toBe(2);
  });
});
