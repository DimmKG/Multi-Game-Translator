// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { alignPhraseFamily, discoverPhraseFamilies } from "./phrase-families";

describe("phrase families with real Necesse values", () => {
  it("does not promote unrelated short descriptions as terminology families", () => {
    const families = discoverPhraseFamilies([
      { key: "dreamcatchertip", value: "Increases mana regen by 100%" },
      { key: "peglegobtain", value: "Dropped from Pirates" },
      { key: "patchnotes", occurrence: 0, value: "See patch notes" },
    ]);

    expect(families).toEqual([]);
  });

  it("keeps duplicate keys distinct by occurrence and aligns their shared term", () => {
    const sourceFamily = discoverPhraseFamilies([
      { key: "patchnotes", occurrence: 0, value: "See patch notes" },
      { key: "patchnotes", occurrence: 1, value: "Patch notes" },
    ])[0];

    expect(sourceFamily).toBeDefined();
    expect(sourceFamily.base.toLocaleLowerCase()).toBe("patch notes");
    expect(sourceFamily.supportKeys).toEqual(["patchnotes", "patchnotes"]);

    expect(
      alignPhraseFamily(sourceFamily, [
        { key: "patchnotes", occurrence: 0, value: "Бележки към актуализацията" },
        { key: "patchnotes", occurrence: 1, value: "Бележки към актуализацията" },
      ]),
    ).toEqual({
      base: {
        source: sourceFamily.base,
        target: "Бележки към актуализацията",
        evidenceKeys: ["patchnotes", "patchnotes"],
      },
      modifiers: [],
    });
  });
});
