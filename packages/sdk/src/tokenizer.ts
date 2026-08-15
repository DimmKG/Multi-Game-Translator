// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * "required" — a value substitution (e.g. `<name>`): dropping it loses data,
 * validation should block on a missing instance.
 * "formatting" — a stylistic/reference marker (e.g. Necesse's `[item/ref=...]`,
 * `§color`): the translator is free to add, drop, or rearrange these for a
 * more natural phrasing. Validation should only warn — and only when a kind
 * present in the source is entirely absent from the translation, not on an
 * exact instance-for-instance match.
 */
export type PlaceholderSeverity = "required" | "formatting";

export interface PlaceholderToken {
  kind: string;
  severity: PlaceholderSeverity;
  raw: string;
  start: number;
  end: number;
  /** Hint for a specialized editor widget, e.g. Factorio's value-level plural sub-grammar. */
  subgrammar?: string;
}

export interface PlaceholderTokenizer {
  tokenize(text: string): PlaceholderToken[];
}
