// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanLangFilename, parseReferenceLang } from "@/core/lang/parse";

/** Necesse English reference files are always shipped as this name. */
export const ENGLISH_REFERENCE_FILENAME = "en.lang";

/** The game identifies the English pack by this exact metadata value. */
export const ENGLISH_ENGNAME_VALUE = "English";

/**
 * Accept `en.lang` and common download duplicates (`en (1).lang`, `en_1.lang`)
 * after the same cleanup used elsewhere for .lang names.
 */
export function normalizeEnglishReferenceFilename(filename: string): string | null {
  const cleaned = cleanLangFilename(filename);
  return /^en\.lang$/i.test(cleaned) ? ENGLISH_REFERENCE_FILENAME : null;
}

/**
 * True when the file body declares `engname=English` (prefixes stripped).
 * That marker is what keeps SAME_TRANSLATION comparisons on English source text.
 */
export function hasEnglishEngname(text: string): boolean {
  const map = parseReferenceLang(text);
  return map.get("engname") === ENGLISH_ENGNAME_VALUE;
}

export type ReferenceValidationFailure = {
  ok: false;
  messageKey: "err.referenceFilename" | "err.referenceEngname";
};

export type ReferenceValidationResult = { ok: true; filename: string } | ReferenceValidationFailure;

/** Shared gate for "load reference" and "new translation from reference". */
export function validateEnglishReferenceFile(
  filename: string,
  text: string,
): ReferenceValidationResult {
  const normalized = normalizeEnglishReferenceFilename(filename);
  if (!normalized) {
    return { ok: false, messageKey: "err.referenceFilename" };
  }
  if (!hasEnglishEngname(text)) {
    return { ok: false, messageKey: "err.referenceEngname" };
  }
  return { ok: true, filename: normalized };
}
