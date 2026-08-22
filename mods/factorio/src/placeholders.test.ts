// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { factorioPlaceholderTokenizer } from "./placeholders";

describe("factorioPlaceholderTokenizer", () => {
  it("tokenizes positional __N__ placeholders as required/positional", () => {
    const tokens = factorioPlaceholderTokenizer.tokenize("You gave __1__ to __2__.");
    expect(tokens).toEqual([
      { kind: "positional", severity: "required", raw: "__1__", start: 9, end: 14 },
      { kind: "positional", severity: "required", raw: "__2__", start: 18, end: 23 },
    ]);
  });

  it("tokenizes a whole plural expression as ONE token, not split apart", () => {
    const text = "You have __plural_for_parameter_1_{1=one item|rest=%d items}__.";
    const tokens = factorioPlaceholderTokenizer.tokenize(text);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      kind: "plural",
      severity: "required",
      subgrammar: "factorio-plural",
      raw: "__plural_for_parameter_1_{1=one item|rest=%d items}__",
    });
  });

  it("tokenizes mixed positional and plural placeholders in one string", () => {
    const text = "__1__ __plural_for_parameter_2_{1=x|rest=y}__";
    const tokens = factorioPlaceholderTokenizer.tokenize(text);
    expect(tokens.map((t) => t.kind)).toEqual(["positional", "plural"]);
  });

  it("returns no tokens for plain text", () => {
    expect(factorioPlaceholderTokenizer.tokenize("Iron plate")).toEqual([]);
  });
});
