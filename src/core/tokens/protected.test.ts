// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { tokenKind, tokensOf } from "./protected";

describe("tokensOf", () => {
  it("extracts protected tokens from text", () => {
    expect(tokensOf("Hello <name>, welcome to [item/ref=sword]")).toEqual([
      "<name>",
      "[item/ref=sword]",
    ]);
  });

  it("returns nothing when text has no protected tokens", () => {
    expect(tokensOf("Hello")).toEqual([]);
  });
});

describe("tokenKind", () => {
  it("classifies each token shape", () => {
    expect(tokenKind("<name>")).toBe("var");
    expect(tokenKind("[item/ref=sword]")).toBe("ref");
    expect(tokenKind("§c")).toBe("fmt");
    expect(tokenKind("\\n")).toBe("nl");
  });
});
