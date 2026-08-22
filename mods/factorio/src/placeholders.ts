// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRegexTokenizer, type PlaceholderClassification } from "@mgt/sdk";

/**
 * Positional __N__ substitutions, or a whole
 * __plural_for_parameter_N_{1=X|rest=Y}__ value-level plural expression —
 * matched as ONE token so the plural mini-grammar never gets split apart by
 * masking/diffing. Both are "required": a lost __N__ loses a substitution, a
 * corrupted plural block breaks the sentence's grammar, neither is a
 * stylistic choice a translator is free to drop.
 */
export const FACTORIO_PLACEHOLDER_PATTERN = /__plural_for_parameter_\d+_\{[^}]*\}__|__\d+__/g;

function classify(match: string): PlaceholderClassification {
  if (match.startsWith("__plural_for_parameter_")) {
    return { kind: "plural", severity: "required", subgrammar: "factorio-plural" };
  }
  return { kind: "positional", severity: "required" };
}

export const factorioPlaceholderTokenizer = createRegexTokenizer(
  FACTORIO_PLACEHOLDER_PATTERN,
  classify,
);
