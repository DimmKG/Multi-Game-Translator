// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { PlaceholderClassification } from "./tokenizer";
import { checkPlaceholders, createRegexTokenizer, maskPlaceholders } from "./tokenizer";

const NECESSE_PATTERN = /<[^>]+>|\[[^\]]+\]|§(?:#[0-9a-fA-F]{6}|[0-9A-Za-z])|\\n/g;

function classify(match: string): PlaceholderClassification {
  if (match.startsWith("<")) return { kind: "var", severity: "required" };
  if (match.startsWith("[")) return { kind: "ref", severity: "formatting" };
  if (match.startsWith("§")) return { kind: "fmt", severity: "formatting" };
  return { kind: "nl", severity: "required" };
}

describe("createRegexTokenizer", () => {
  it("tokenizes with kind/severity/raw/start/end", () => {
    const tokenizer = createRegexTokenizer(NECESSE_PATTERN, classify);
    const tokens = tokenizer.tokenize("Hi <name>, see [item/ref=1]!");
    expect(tokens).toEqual([
      { kind: "var", severity: "required", raw: "<name>", start: 3, end: 9 },
      { kind: "ref", severity: "formatting", raw: "[item/ref=1]", start: 15, end: 27 },
    ]);
  });

  it("returns no tokens when nothing matches", () => {
    const tokenizer = createRegexTokenizer(NECESSE_PATTERN, classify);
    expect(tokenizer.tokenize("plain text")).toEqual([]);
  });
});

describe("maskPlaceholders", () => {
  it("round-trips text through mask and restore", () => {
    const tokenizer = createRegexTokenizer(NECESSE_PATTERN, classify);
    const text = "Hi <name>, see [item/ref=1]!";
    const { maskedText, restore } = maskPlaceholders(text, tokenizer);
    expect(maskedText).not.toContain("<name>");
    expect(maskedText).not.toContain("[item/ref=1]");
    expect(restore(maskedText)).toBe(text);
  });

  it("is a no-op when the tokenizer finds nothing", () => {
    const tokenizer = createRegexTokenizer(NECESSE_PATTERN, classify);
    const { maskedText, restore } = maskPlaceholders("plain text", tokenizer);
    expect(maskedText).toBe("plain text");
    expect(restore(maskedText)).toBe("plain text");
  });
});

describe("checkPlaceholders", () => {
  const tokenizer = createRegexTokenizer(NECESSE_PATTERN, classify);

  it("flags a missing required token individually", () => {
    const result = checkPlaceholders("Hi <name>!", "Hi!", tokenizer);
    expect(result.missingRequired).toEqual([
      { kind: "var", severity: "required", raw: "<name>", start: 3, end: 9 },
    ]);
    expect(result.missingFormattingKinds).toEqual([]);
  });

  it("does not flag a required token that reappears elsewhere in the translation", () => {
    const result = checkPlaceholders("Hi <name>!", "<name>, hi!", tokenizer);
    expect(result.missingRequired).toEqual([]);
  });

  it("flags a formatting kind only when it is entirely absent from the translation", () => {
    const result = checkPlaceholders(
      "See [item/ref=1] and [item/ref=2].",
      "See it and it.",
      tokenizer,
    );
    expect(result.missingRequired).toEqual([]);
    expect(result.missingFormattingKinds).toEqual(["ref"]);
  });

  it("does not flag a formatting kind when the translator used a different count/order", () => {
    const result = checkPlaceholders(
      "See [item/ref=1] and [item/ref=2].",
      "See [item/ref=2] only.",
      tokenizer,
    );
    expect(result.missingFormattingKinds).toEqual([]);
  });

  it("reports nothing for a fully preserved translation", () => {
    const result = checkPlaceholders(
      "Hi <name>, see [item/ref=1]!",
      "Hi <name>, see [item/ref=1]!",
      tokenizer,
    );
    expect(result.missingRequired).toEqual([]);
    expect(result.missingFormattingKinds).toEqual([]);
  });
});
