// SPDX-License-Identifier: LGPL-3.0-or-later

/** The 6 CLDR plural categories — https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html */
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * Fixed 6-state entry lifecycle. Every Game Loader maps its native status
 * model onto this set; richer native models collapse into it explicitly
 * rather than growing the core enum.
 */
export type EntryStatus = "new" | "missing" | "draft" | "translated" | "same" | "reviewed";

export const ENTRY_STATUSES: readonly EntryStatus[] = [
  "new",
  "missing",
  "draft",
  "translated",
  "same",
  "reviewed",
];

export interface EntryNote {
  kind: "translator" | "extracted" | "reference" | "previous" | "pinned";
  text: string;
}

export interface TranslationEntry {
  /** Stable id — see EntryIdentityStrategy in game-loader.ts. */
  id: string;
  /** Necesse [section] / PO msgctxt / Factorio section. */
  namespace?: string;
  key: string;
  source: string;
  /**
   * Present ONLY when the owning GameLoader defines a pluralSelector.
   * Absence means "this format has no plural concept", not "one category".
   */
  sourcePlurals?: Partial<Record<PluralCategory, string>>;
  target: string;
  targetPlurals?: Partial<Record<PluralCategory, string>>;
  status: EntryStatus;
  notes?: EntryNote[];
  /** Escape hatch for Game/File Loader specifics; the core never branches on this. */
  ext: Record<string, unknown>;
}

export type StructuralNode =
  | { type: "blank"; raw: string }
  | { type: "comment"; raw: string }
  | { type: "section"; raw: string; name: string }
  | { type: "header"; fields: Record<string, string>; raw?: string };

export type DocumentNode = StructuralNode | { type: "entry"; entry: TranslationEntry };

export interface TranslationDocument {
  gameLoaderId: string;
  fileLoaderId: string;
  sourceLocale: string;
  targetLocale: string;
  /** Flat, ordered list — what the editor virtualizes. */
  nodes: DocumentNode[];
  /** eol/BOM/indent and other round-trip formatting details. */
  formatMeta: Record<string, unknown>;
  /** Plural-rule id, placeholder dialect id, locale info, etc. */
  gameMeta: Record<string, unknown>;
}
