import type { TranslationEntry } from "@/core/lang/status";
import { referenceSource } from "@/core/lang/status";

const LEADING_WHITESPACE = /^[ \t\u00A0]+/;
const TRAILING_WHITESPACE = /[ \t\u00A0]+$/;
const DOUBLE_SPACES = / {2,}/;

export interface WhitespaceAnomalies {
  lead: boolean;
  trail: boolean;
  dbl: boolean;
  tab: boolean;
  nbsp: boolean;
  any: boolean;
}

/** Flags whitespace in the translation that the English/reference source does not have. */
export function scanWhitespace(entry: TranslationEntry): WhitespaceAnomalies {
  const value = entry.value;
  const english = referenceSource(entry);
  const lead =
    LEADING_WHITESPACE.test(value) && !(english != null && LEADING_WHITESPACE.test(english));
  const trail =
    TRAILING_WHITESPACE.test(value) && !(english != null && TRAILING_WHITESPACE.test(english));
  const core = value.replace(LEADING_WHITESPACE, "").replace(TRAILING_WHITESPACE, "");
  const englishCore =
    english != null
      ? english.replace(LEADING_WHITESPACE, "").replace(TRAILING_WHITESPACE, "")
      : null;
  const dbl = DOUBLE_SPACES.test(core) && !(englishCore != null && DOUBLE_SPACES.test(englishCore));
  const tab = value.includes("\t") && !(english != null && english.includes("\t"));
  const nbsp = value.includes("\u00A0") && !(english != null && english.includes("\u00A0"));
  return { lead, trail, dbl, tab, nbsp, any: lead || trail || dbl || tab || nbsp };
}

export function fixWhitespace(entry: TranslationEntry): string {
  const english = referenceSource(entry);
  let value = entry.value
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(LEADING_WHITESPACE, "")
    .replace(TRAILING_WHITESPACE, "")
    .replace(/ {2,}/g, " ");
  if (english != null) {
    value =
      (english.match(LEADING_WHITESPACE) || [""])[0] +
      value +
      (english.match(TRAILING_WHITESPACE) || [""])[0];
  }
  return value;
}

export function countWhitespaceIssues(entries: TranslationEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (scanWhitespace(entry).any) count += 1;
  }
  return count;
}
