// SPDX-License-Identifier: LGPL-3.0-or-later
import type { PlaceholderSeverity, PlaceholderToken, PlaceholderTokenizer } from "../tokenizer";

export interface PlaceholderClassification {
  kind: string;
  severity: PlaceholderSeverity;
}

/** Build a PlaceholderTokenizer from a regex; almost every simple loader needs no more than this. */
export function createRegexTokenizer(
  pattern: RegExp,
  classify: (match: string) => PlaceholderClassification,
): PlaceholderTokenizer {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return {
    tokenize(text: string): PlaceholderToken[] {
      const regex = new RegExp(pattern.source, flags);
      const tokens: PlaceholderToken[] = [];
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        tokens.push({
          ...classify(match[0]),
          raw: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
        if (match[0].length === 0) regex.lastIndex += 1;
      }
      return tokens;
    },
  };
}

const PLACEHOLDER_PREFIX = "";
const PLACEHOLDER_SUFFIX = "";

/** Mask a tokenizer's matches before MT, restore them afterwards — generalizes maskProtectedTokens. */
export function maskPlaceholders(
  text: string,
  tokenizer: PlaceholderTokenizer,
): { maskedText: string; restore: (translated: string) => string } {
  const tokens = tokenizer.tokenize(text);
  const captured: string[] = [];
  let masked = "";
  let cursor = 0;
  for (const token of tokens) {
    masked += text.slice(cursor, token.start);
    const index = captured.length;
    captured.push(token.raw);
    masked += `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
    cursor = token.end;
  }
  masked += text.slice(cursor);

  const restore = (translated: string) =>
    translated.replace(
      new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, "g"),
      (_match, indexText: string) => captured[Number(indexText)] ?? "",
    );

  return { maskedText: masked, restore };
}

export interface PlaceholderCheckResult {
  /** Required tokens present in source but missing from target — block on these. */
  missingRequired: PlaceholderToken[];
  /**
   * Formatting kinds present in source but entirely absent from target — warn
   * on these. Not an instance-for-instance diff: the translator may freely
   * add, drop, or rearrange formatting markers, so only total absence of a
   * kind is flagged.
   */
  missingFormattingKinds: string[];
}

/**
 * Multiset-aware for required tokens (mirrors today's missingTokens()); a
 * coarser presence-only check for formatting tokens (see PlaceholderSeverity).
 */
export function checkPlaceholders(
  source: string,
  target: string,
  tokenizer: PlaceholderTokenizer,
): PlaceholderCheckResult {
  const sourceTokens = tokenizer.tokenize(source);
  const targetTokens = tokenizer.tokenize(target);

  const requiredPool = targetTokens
    .filter((token) => token.severity === "required")
    .map((t) => t.raw);
  const missingRequired: PlaceholderToken[] = [];
  for (const token of sourceTokens) {
    if (token.severity !== "required") continue;
    const index = requiredPool.indexOf(token.raw);
    if (index === -1) missingRequired.push(token);
    else requiredPool.splice(index, 1);
  }

  const targetFormattingKinds = new Set(
    targetTokens.filter((token) => token.severity === "formatting").map((token) => token.kind),
  );
  const missingFormattingKinds = [
    ...new Set(
      sourceTokens
        .filter((token) => token.severity === "formatting")
        .map((token) => token.kind)
        .filter((kind) => !targetFormattingKinds.has(kind)),
    ),
  ];

  return { missingRequired, missingFormattingKinds };
}
