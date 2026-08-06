// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { normalizeSearchQuery } from "@/core/lang/search-query";

describe("normalizeSearchQuery", () => {
  it("trims ordinary text and lowercases it", () => {
    expect(normalizeSearchQuery("  Hello  ")).toBe("hello");
  });

  it("keeps a double-space query used by the toolbar button", () => {
    expect(normalizeSearchQuery("  ")).toBe("  ");
  });

  it("keeps other whitespace-only queries", () => {
    expect(normalizeSearchQuery("\t")).toBe("\t");
    expect(normalizeSearchQuery(" ")).toBe(" ");
  });

  it("treats an empty string as an empty query", () => {
    expect(normalizeSearchQuery("")).toBe("");
  });
});
