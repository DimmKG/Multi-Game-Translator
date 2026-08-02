// SPDX-License-Identifier: AGPL-3.0-or-later
import { PROTECTED_TOKEN_PATTERN } from "@/core/lang/markers";
import type { TranslationEntry } from "@/core/lang/status";
import { sourceText } from "@/core/lang/status";

export type TokenKind = "var" | "ref" | "fmt" | "nl";

export function tokensOf(text: string): string[] {
  return text.match(PROTECTED_TOKEN_PATTERN) ?? [];
}

export function tokenKind(token: string): TokenKind {
  if (token.startsWith("<")) return "var";
  if (token.startsWith("[")) return "ref";
  if (token.startsWith("§")) return "fmt";
  return "nl";
}

/** Multiset-aware: tokens present in source but missing from translation. */
export function missingTokens(entry: TranslationEntry): string[] {
  const sourceTokens = tokensOf(sourceText(entry));
  if (!sourceTokens.length) return [];
  const available = tokensOf(entry.value).slice();
  const missing: string[] = [];
  for (const token of sourceTokens) {
    const index = available.indexOf(token);
    if (index === -1) missing.push(token);
    else available.splice(index, 1);
  }
  return [...new Set(missing)];
}

const PLACEHOLDER_PREFIX = "\uE000";
const PLACEHOLDER_SUFFIX = "\uE001";

/** Mask protected tokens before MT, restore afterwards. */
export function maskProtectedTokens(text: string): {
  maskedText: string;
  restore: (translated: string) => string;
} {
  const captured: string[] = [];
  const maskedText = text.replace(PROTECTED_TOKEN_PATTERN, (match) => {
    const index = captured.length;
    captured.push(match);
    return `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
  });

  const restore = (translated: string) =>
    translated.replace(
      new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, "g"),
      (_, indexText: string) => captured[Number(indexText)] ?? "",
    );

  return { maskedText, restore };
}
