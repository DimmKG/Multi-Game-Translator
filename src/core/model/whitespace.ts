// SPDX-License-Identifier: AGPL-3.0-or-later
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

/** Flags whitespace in `target` that `reference` does not have. Entry-shape-agnostic version of the old scanWhitespace. */
export function scanWhitespace(target: string, reference: string | null): WhitespaceAnomalies {
  const lead =
    LEADING_WHITESPACE.test(target) && !(reference != null && LEADING_WHITESPACE.test(reference));
  const trail =
    TRAILING_WHITESPACE.test(target) && !(reference != null && TRAILING_WHITESPACE.test(reference));
  const core = target.replace(LEADING_WHITESPACE, "").replace(TRAILING_WHITESPACE, "");
  const referenceCore =
    reference != null
      ? reference.replace(LEADING_WHITESPACE, "").replace(TRAILING_WHITESPACE, "")
      : null;
  const dbl =
    DOUBLE_SPACES.test(core) && !(referenceCore != null && DOUBLE_SPACES.test(referenceCore));
  const tab = target.includes("\t") && !(reference != null && reference.includes("\t"));
  const nbsp = target.includes("\u00A0") && !(reference != null && reference.includes("\u00A0"));
  return { lead, trail, dbl, tab, nbsp, any: lead || trail || dbl || tab || nbsp };
}

export function fixWhitespace(target: string, reference: string | null): string {
  let fixed = target
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(LEADING_WHITESPACE, "")
    .replace(TRAILING_WHITESPACE, "")
    .replace(/ {2,}/g, " ");
  if (reference != null) {
    fixed =
      (reference.match(LEADING_WHITESPACE) || [""])[0] +
      fixed +
      (reference.match(TRAILING_WHITESPACE) || [""])[0];
  }
  return fixed;
}
