// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  compareEntryPair,
  diffRows,
  inlineSegments,
  parseLine,
  summarizeRows,
  tokenizeUnits,
  type DiffOptions,
} from "./token-aware-diff";

// This module knows nothing about any one game's format — every test below
// either uses the built-in generic defaults or supplies its own ad hoc
// convention, never Necesse's. Necesse-flavored behavior (real status
// prefixes) lives in token-aware-diff.necesse.test.ts instead.
describe("tokenizeUnits", () => {
  it("splits punctuation from words in word mode", () => {
    expect(tokenizeUnits("Hello, world!")).toEqual(["Hello", ",", " ", "world", "!"]);
  });

  it("treats a run of non-Latin letters as one word — Cyrillic and CJK", () => {
    expect(tokenizeUnits("Привет, мир!")).toEqual(["Привет", ",", " ", "мир", "!"]);
    expect(tokenizeUnits("你好，世界")).toEqual(["你好", "，", "世界"]);
  });

  it("splits every codepoint individually in character mode, no atomicity", () => {
    expect(tokenizeUnits("ab.cd", "character")).toEqual(["a", "b", ".", "c", "d"]);
  });
});

describe("inlineSegments", () => {
  it("an unchanged placeholder-like run reads as one merged equal segment in word mode", () => {
    const result = inlineSegments("Hello <name>!", "Hi <name>!");
    const leftEqual = result.left
      .filter((segment) => segment.kind === "equal")
      .map((segment) => segment.text)
      .join("");
    const rightEqual = result.right
      .filter((segment) => segment.kind === "equal")
      .map((segment) => segment.text)
      .join("");
    expect(leftEqual).toContain("<name>");
    expect(rightEqual).toContain("<name>");
    // Not one atomic token internally — <, name, > are three runs that just
    // happen to all align as equal and get concatenated back together.
    expect(result.left.some((segment) => segment.text === "<")).toBe(false);
  });

  it("a partially changed placeholder highlights only the part that changed", () => {
    const result = inlineSegments("<name>", "<user>");
    expect(result.left.map((s) => `${s.kind}:${s.text}`)).toEqual([
      "equal:<",
      "delete:name",
      "equal:>",
    ]);
    expect(result.right.map((s) => `${s.kind}:${s.text}`)).toEqual([
      "equal:<",
      "add:user",
      "equal:>",
    ]);
  });

  it("large inline comparisons use a safe fallback", () => {
    const result = inlineSegments("a".repeat(300), "b".repeat(300), {
      mode: "character",
      matrixLimit: 1000,
    });
    expect(result.fallback).toBe(true);
  });
});

describe("parseLine — default (no per-game convention)", () => {
  it("classifies blank/comment/section lines as text, no status concept at all", () => {
    expect(parseLine("").type).toBe("text");
    expect(parseLine("// comment").type).toBe("text");
    expect(parseLine("# comment").type).toBe("text");
    expect(parseLine("[section]").type).toBe("text");
  });

  it("splits a plain key=value line with status always null", () => {
    const parsed = parseLine("greeting=Hello");
    expect(parsed).toMatchObject({
      type: "entry",
      status: null,
      prefix: "",
      key: "greeting",
      value: "Hello",
    });
  });
});

describe("diffRows/summarizeRows/compareEntryPair — case 3: zero configuration", () => {
  // A generic-ini-shaped file (no status markers of any kind) diffed with
  // no options object at all — proving the tool works out of the box.
  const left = ["[misc]", "greeting=Hello", "farewell=Bye"];
  const right = ["[misc]", "greeting=Hi", "farewell=Bye"];

  it("diffRows aligns and flags the changed row with no options argument", () => {
    const rows = diffRows(left, right);
    expect(rows).toHaveLength(3);
    expect(rows[1].kind).toBe("change");
    expect(rows[1].prefixOnly).toBeFalsy();
  });

  it("summarizeRows and compareEntryPair also need no options argument", () => {
    const rows = diffRows(left, right);
    expect(summarizeRows(rows, left, right)).toMatchObject({
      changed: 1,
      changedKeys: 0,
      changedValues: 1,
    });
    const detail = compareEntryPair(left[1], right[1]);
    expect(detail).toMatchObject({
      type: "entry",
      keyChanged: false,
      valueChanged: true,
      statusChanged: false,
    });
  });
});

describe("diffRows/summarizeRows — case 2: an ad hoc, non-Necesse convention", () => {
  // A fictitious "DRAFT:" marker, defined only in this test — proves the
  // identity/parseEntryLine callbacks generalize to any convention, not just
  // Necesse's real one.
  const draftDialect: DiffOptions = {
    identity: (line) => (line.startsWith("DRAFT:") ? line.slice("DRAFT:".length) : line),
    parseEntryLine: (line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const isDraft = trimmed.startsWith("DRAFT:");
      const body = isDraft ? trimmed.slice("DRAFT:".length) : trimmed;
      const separator = body.indexOf("=");
      if (separator < 0) return null;
      return {
        status: isDraft ? "draft" : null,
        prefix: isDraft ? "DRAFT:" : "",
        key: body.slice(0, separator),
        value: body.slice(separator + 1),
      };
    },
  };

  it("a status-only marker change aligns as one row, flagged prefixOnly", () => {
    const left = ["DRAFT:greeting=Hello"];
    const right = ["greeting=Hello"];
    const rows = diffRows(left, right, draftDialect);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("change");
    expect(rows[0].prefixOnly).toBe(true);
    expect(summarizeRows(rows, left, right, draftDialect)).toMatchObject({
      changed: 1,
      prefixOnly: 1,
    });
  });

  it("compareEntryPair reports statusChanged for the same marker flip", () => {
    const detail = compareEntryPair("DRAFT:greeting=Hello", "greeting=Hello", draftDialect);
    expect(detail).toMatchObject({
      type: "entry",
      statusChanged: true,
      keyChanged: false,
      valueChanged: false,
    });
  });
});
