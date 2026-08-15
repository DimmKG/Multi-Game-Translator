// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { TranslationDocument } from "../model/document";
import { createCldrPluralSelector } from "./plural";

function docFor(targetLocale: string): TranslationDocument {
  return {
    gameLoaderId: "test",
    fileLoaderId: "test",
    sourceLocale: "en",
    targetLocale,
    nodes: [],
    formatMeta: {},
    gameMeta: {},
  };
}

describe("createCldrPluralSelector", () => {
  it("reports only one/other for English", () => {
    const selector = createCldrPluralSelector();
    expect(selector.categoriesFor(docFor("en"))).toEqual(["one", "other"]);
    expect(selector.select(1, docFor("en"))).toBe("one");
    expect(selector.select(2, docFor("en"))).toBe("other");
  });

  it("reports one/few/many/other for Russian", () => {
    const selector = createCldrPluralSelector();
    expect(selector.categoriesFor(docFor("ru"))).toEqual(["one", "few", "many", "other"]);
    expect(selector.select(1, docFor("ru"))).toBe("one");
    expect(selector.select(3, docFor("ru"))).toBe("few");
    expect(selector.select(5, docFor("ru"))).toBe("many");
  });

  it("reports only other for Japanese", () => {
    const selector = createCldrPluralSelector();
    expect(selector.categoriesFor(docFor("ja"))).toEqual(["other"]);
    expect(selector.select(1, docFor("ja"))).toBe("other");
  });
});
