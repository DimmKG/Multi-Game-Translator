// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  createRegexTokenizer,
  type PlaceholderClassification,
  type PlaceholderTokenizer,
} from "@mgt/sdk";

/** Same pattern as today's PROTECTED_TOKEN_PATTERN. */
const NECESSE_PLACEHOLDER_PATTERN = /<[^>]+>|\[[^\]]+\]|§(?:#[0-9a-fA-F]{6}|[0-9A-Za-z])|\\n/g;

/**
 * "required": <var> substitutions and the literal \n line-break escape — losing
 * either changes the string's meaning/layout, not just its style.
 * "formatting": [item/ref=...] and §color markers — stylistic/reference tags a
 * translator may freely add, drop, or rearrange. \n as "required" is a
 * judgment call: losing it changes text layout, closer to a data loss than a
 * style choice.
 */
function classify(match: string): PlaceholderClassification {
  if (match.startsWith("<")) return { kind: "var", severity: "required" };
  if (match.startsWith("[")) return { kind: "ref", severity: "formatting" };
  if (match.startsWith("§")) return { kind: "fmt", severity: "formatting" };
  return { kind: "nl", severity: "required" };
}

export const necessePlaceholderTokenizer: PlaceholderTokenizer = createRegexTokenizer(
  NECESSE_PLACEHOLDER_PATTERN,
  classify,
);
