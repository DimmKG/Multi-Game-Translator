// SPDX-License-Identifier: AGPL-3.0-or-later
import { NECESSE_PLACEHOLDER_PATTERN } from "@mgt/mod-necesse";

export type TokenKind = "var" | "ref" | "fmt" | "nl";

export function tokensOf(text: string): string[] {
  return text.match(NECESSE_PLACEHOLDER_PATTERN) ?? [];
}

export function tokenKind(token: string): TokenKind {
  if (token.startsWith("<")) return "var";
  if (token.startsWith("[")) return "ref";
  if (token.startsWith("§")) return "fmt";
  return "nl";
}

const PLACEHOLDER_PREFIX = "\uE000";
const PLACEHOLDER_SUFFIX = "\uE001";

/** Mask protected tokens before MT, restore afterwards. */
export function maskProtectedTokens(text: string): {
  maskedText: string;
  restore: (translated: string) => string;
} {
  const captured: string[] = [];
  const maskedText = text.replace(NECESSE_PLACEHOLDER_PATTERN, (match) => {
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
