// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseIniLines } from "@mgt/sdk";
import { stripStatusPrefix } from "./markers";

/** Necesse English reference files are always shipped as this name. */
export const ENGLISH_REFERENCE_FILENAME = "en.lang";

/** The game identifies the English pack by this exact metadata value. */
export const ENGLISH_ENGNAME_VALUE = "English";

/** Strip download-duplication artifacts without breaking locale codes like pt-BR. */
function cleanLangFilename(name: string): string {
  let base = String(name || "").replace(/\.lang$/i, "");
  base = base.replace(/\s*\(\d+\)\s*$/, "");
  base = base.replace(/_\d+_?/g, "");
  base = base.replace(/^_+|_+$/g, "");
  return base ? `${base}.lang` : "translation.lang";
}

/**
 * Accept `en.lang` and common download duplicates (`en (1).lang`, `en_1.lang`)
 * after the same cleanup used elsewhere for .lang names.
 */
export function normalizeEnglishReferenceFilename(filename: string): string | null {
  const cleaned = cleanLangFilename(filename);
  return /^en\.lang$/i.test(cleaned) ? ENGLISH_REFERENCE_FILENAME : null;
}

/**
 * True when the file body declares `engname=English` (prefixes stripped),
 * in any section. That marker is what keeps SAME_TRANSLATION comparisons on
 * English source text.
 */
export function hasEnglishEngname(text: string): boolean {
  const raw = parseIniLines(text);
  for (const line of raw.lines) {
    if (line.type !== "pair") continue;
    const { key } = stripStatusPrefix(line.key);
    if (key === "engname") return line.value === ENGLISH_ENGNAME_VALUE;
  }
  return false;
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
