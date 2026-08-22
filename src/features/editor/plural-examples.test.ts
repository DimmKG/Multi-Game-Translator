// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { pluralCategoryExamples } from "./plural-examples";

describe("pluralCategoryExamples", () => {
  it("gives up to 3 examples per Russian category, matching real CLDR buckets", () => {
    const examples = pluralCategoryExamples("ru");
    expect(examples.one).toEqual([1, 21, 31]);
    expect(
      examples.few?.every((n) => [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n)),
    ).toBe(true);
    expect(examples.many).toBeDefined();
  });

  it("gives English only one/other", () => {
    const examples = pluralCategoryExamples("en");
    expect(Object.keys(examples).sort()).toEqual(["one", "other"]);
    expect(examples.one).toEqual([1]);
  });

  it("caches per locale (same reference on repeated calls)", () => {
    expect(pluralCategoryExamples("fr")).toBe(pluralCategoryExamples("fr"));
  });

  it("degrades to an empty map for an invalid locale rather than throwing", () => {
    expect(pluralCategoryExamples("not-a-real-locale-!!!")).toEqual({});
  });
});
