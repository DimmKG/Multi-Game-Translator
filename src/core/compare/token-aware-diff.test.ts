import { describe, expect, it } from "vitest";

import {
  compareEntryPair,
  diffRows,
  inlineSegments,
  parseLangLine,
  summarizeRows,
  tokenizeProtected,
} from "./token-aware-diff";

describe("token-aware-diff", () => {
  it("status prefixes are ignored for alignment but remain visible as changes", () => {
    const left = ["MISSING_TRANSLATION:greeting=Hello"];
    const right = ["greeting=Hello"];
    const rows = diffRows(left, right);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("change");
    expect(rows[0].prefixOnly).toBe(true);
    expect(summarizeRows(rows, left, right)).toEqual({
      added: 0,
      deleted: 0,
      changed: 1,
      prefixOnly: 1,
      changedKeys: 0,
      changedValues: 0,
    });
  });

  it("entry comparison reports key and value changes separately", () => {
    const detail = compareEntryPair("oldkey=Old value", "newkey=New value");
    expect(detail.type).toBe("entry");
    if (detail.type === "entry") {
      expect(detail.statusChanged).toBe(false);
      expect(detail.keyChanged).toBe(true);
      expect(detail.valueChanged).toBe(true);
    }
  });

  it("protected placeholders remain atomic in word mode", () => {
    const result = inlineSegments("Hello <name>!", "Hi <name>!", "word");
    const leftEqual = result.left
      .filter((segment) => segment.kind === "equal")
      .map((segment) => segment.text)
      .join("");
    const rightEqual = result.right
      .filter((segment) => segment.kind === "equal")
      .map((segment) => segment.text)
      .join("");
    expect(leftEqual).toMatch(/<name>/);
    expect(rightEqual).toMatch(/<name>/);
    expect(result.left.some((segment) => segment.text === "<")).toBe(false);
    expect(result.right.some((segment) => segment.text === ">")).toBe(false);
  });

  it("references, formatting codes and literal newlines remain atomic in character mode", () => {
    const text = "[item=wood] §aValue\\n";
    const units = tokenizeProtected(text, "character");
    const protectedValues = units.filter((unit) => unit.protected).map((unit) => unit.value);
    expect(protectedValues).toEqual(["[item=wood]", "§a", "\\n"]);
  });

  it("comments and section headers stay on the ordinary text path", () => {
    expect(parseLangLine("// comment").type).toBe("text");
    expect(parseLangLine("[lang]").type).toBe("text");
  });

  it("large inline comparisons use a safe fallback", () => {
    const result = inlineSegments("a".repeat(300), "b".repeat(300), "character", 1000);
    expect(result.fallback).toBe(true);
  });
});
