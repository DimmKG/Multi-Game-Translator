// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { buildFactorioPluralExpression, parseFactorioPluralExpression } from "./plural-subgrammar";

describe("parseFactorioPluralExpression / buildFactorioPluralExpression", () => {
  it("round-trips a 2-bucket expression", () => {
    const raw = "__plural_for_parameter_1_{1=one item|rest=%d items}__";
    const parsed = parseFactorioPluralExpression(raw);
    expect(parsed).toEqual({
      parameterIndex: 1,
      buckets: [
        { key: 1, value: "one item" },
        { key: "rest", value: "%d items" },
      ],
    });
    expect(buildFactorioPluralExpression(parsed!)).toBe(raw);
  });

  it("round-trips a 3+-bucket expression with numbered buckets before rest", () => {
    const raw = "__plural_for_parameter_2_{1=one|2=two|rest=many}__";
    const parsed = parseFactorioPluralExpression(raw);
    expect(parsed?.buckets).toEqual([
      { key: 1, value: "one" },
      { key: 2, value: "two" },
      { key: "rest", value: "many" },
    ]);
    expect(buildFactorioPluralExpression(parsed!)).toBe(raw);
  });

  it.each([
    ["not the plural shape at all", "just some text"],
    ["unbalanced braces", "__plural_for_parameter_1_{1=one item|rest=items"],
    ["non-numeric parameter index", "__plural_for_parameter_x_{1=one|rest=many}__"],
    ["a bucket with no =", "__plural_for_parameter_1_{one item|rest=items}__"],
    ["an invalid bucket key", "__plural_for_parameter_1_{first=one|rest=items}__"],
  ])("fails soft (undefined) on malformed input (%s), never throws", (_label, raw) => {
    expect(parseFactorioPluralExpression(raw)).toBeUndefined();
  });
});
