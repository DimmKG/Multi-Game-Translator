// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { alignPhraseFamily, discoverPhraseFamilies } from "./phrase-families";

describe("discoverPhraseFamilies", () => {
  it("extracts a repeated subject from sentence-like values", () => {
    const families = discoverPhraseFamilies([
      { key: "heal", value: "Seed Launcher restores health on hit" },
      { key: "range", value: "Seed Launcher has increased speed and range" },
      { key: "mana", value: "Increases mana regeneration by 100%" },
    ]);

    expect(families).toEqual([
      {
        base: "Seed Launcher",
        supportKeys: ["heal", "range"],
        members: [
          {
            key: "heal",
            value: "Seed Launcher restores health on hit",
            prefix: "",
            suffix: "restores health on hit",
          },
          {
            key: "range",
            value: "Seed Launcher has increased speed and range",
            prefix: "",
            suffix: "has increased speed and range",
          },
        ],
      },
    ]);
  });

  it("finds a base name and preserves its modifiers", () => {
    const families = discoverPhraseFamilies([
      { key: "base", value: "Alchemical Workstation" },
      { key: "abyssal", value: "Abyssal Alchemical Workstation" },
      { key: "fallen", value: "Fallen Alchemical Workstation" },
    ]);

    expect(families).toContainEqual({
      base: "Alchemical Workstation",
      supportKeys: ["base", "abyssal", "fallen"],
      members: [
        {
          key: "base",
          value: "Alchemical Workstation",
          prefix: "",
          suffix: "",
        },
        {
          key: "abyssal",
          value: "Abyssal Alchemical Workstation",
          prefix: "Abyssal",
          suffix: "",
        },
        {
          key: "fallen",
          value: "Fallen Alchemical Workstation",
          prefix: "Fallen",
          suffix: "",
        },
      ],
    });
  });

  it("works when another language places modifiers after the base", () => {
    const families = discoverPhraseFamilies([
      { key: "base", value: "Алхимичен тезгях" },
      { key: "abyssal", value: "Алхимичен тезгях на Бездната" },
      { key: "fallen", value: "Алхимичен тезгях на Падналите" },
    ]);

    expect(families).toContainEqual({
      base: "Алхимичен тезгях",
      supportKeys: ["base", "abyssal", "fallen"],
      members: [
        {
          key: "base",
          value: "Алхимичен тезгях",
          prefix: "",
          suffix: "",
        },
        {
          key: "abyssal",
          value: "Алхимичен тезгях на Бездната",
          prefix: "",
          suffix: "на Бездната",
        },
        {
          key: "fallen",
          value: "Алхимичен тезгях на Падналите",
          prefix: "",
          suffix: "на Падналите",
        },
      ],
    });
  });

  it("does not promote unrelated one-word overlaps", () => {
    const families = discoverPhraseFamilies([
      { key: "one", value: "Increases health regeneration" },
      { key: "two", value: "Increases mana regeneration" },
    ]);

    expect(families).toEqual([]);
  });
});

describe("alignPhraseFamily", () => {
  it("aligns a repeated sentence subject without promoting sentence tails", () => {
    const sourceFamily = discoverPhraseFamilies([
      { key: "heal", value: "Seed Launcher restores health on hit" },
      { key: "range", value: "Seed Launcher has increased speed and range" },
    ])[0];

    expect(
      alignPhraseFamily(sourceFamily, [
        { key: "heal", value: "Семенострелът възстановява здраве при попадение" },
        { key: "range", value: "Семенострелът има по-висока скорост и далечина" },
      ]),
    ).toEqual({
      base: {
        source: "Seed Launcher",
        target: "Семенострелът",
        evidenceKeys: ["heal", "range"],
      },
      modifiers: [],
    });
  });

  it("aligns base names and removes a shared target modifier affix", () => {
    const sourceFamily = discoverPhraseFamilies([
      { key: "base", value: "Alchemical Workstation" },
      { key: "abyssal", value: "Abyssal Alchemical Workstation" },
      { key: "fallen", value: "Fallen Alchemical Workstation" },
    ])[0];

    expect(
      alignPhraseFamily(sourceFamily, [
        { key: "base", value: "Алхимичен тезгях" },
        { key: "abyssal", value: "Алхимичен тезгях на Бездната" },
        { key: "fallen", value: "Алхимичен тезгях на Падналите" },
      ]),
    ).toEqual({
      base: {
        source: "Alchemical Workstation",
        target: "Алхимичен тезгях",
        evidenceKeys: ["base", "abyssal", "fallen"],
      },
      modifiers: [
        { source: "Abyssal", target: "Бездната", evidenceKeys: ["abyssal"] },
        { source: "Fallen", target: "Падналите", evidenceKeys: ["fallen"] },
      ],
    });
  });

  it("returns null when the aligned target keys do not form a matching family", () => {
    const sourceFamily = discoverPhraseFamilies([
      { key: "base", value: "Alchemical Workstation" },
      { key: "abyssal", value: "Abyssal Alchemical Workstation" },
    ])[0];

    expect(
      alignPhraseFamily(sourceFamily, [
        { key: "base", value: "Алхимичен тезгях" },
        { key: "abyssal", value: "Съвсем различно име" },
      ]),
    ).toBeNull();
  });
});
