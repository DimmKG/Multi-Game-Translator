// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { checkPlaceholders } from "./protected";

describe("checkPlaceholders", () => {
  it("returns tokens present in source but missing from target", () => {
    expect(checkPlaceholders("Hello <name>", "Hallo")).toEqual(["<name>"]);
  });

  it("returns nothing when every source token is present in target", () => {
    expect(checkPlaceholders("Hello <name>", "Hallo <name>")).toEqual([]);
  });

  it("is multiset-aware: two occurrences of a token need two matches", () => {
    expect(checkPlaceholders("<a> and <a>", "<a>")).toEqual(["<a>"]);
    expect(checkPlaceholders("<a> and <a>", "<a> und <a>")).toEqual([]);
  });

  it("returns nothing when source has no protected tokens", () => {
    expect(checkPlaceholders("Hello", "Hallo")).toEqual([]);
  });
});
