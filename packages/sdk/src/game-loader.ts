// SPDX-License-Identifier: LGPL-3.0-or-later
import type { FileLoaderInput } from "./file-loader";
import type { PluralCategory, TranslationDocument, TranslationEntry } from "./model/document";
import type { PlaceholderTokenizer } from "./tokenizer";

export interface RequiredFile {
  /** Dropzone slot id, e.g. "translation" | "reference" | "template". */
  role: string;
  labelKey: string;
  required: boolean;
  accept: string[];
  validate?(file: { name: string; text: string }): { ok: true } | { ok: false; messageKey: string };
}

export interface EntryIdentityStrategy {
  /**
   * Stable entry id. occurrenceIndex is the running count of repeats of the
   * same (namespace, key) pair seen so far in the document.
   */
  makeEntryId(namespace: string | undefined, key: string, occurrenceIndex: number): string;
  /**
   * Optionally group a key into a family of related entries (e.g. plural/gender
   * variants stored as separate keys in formats without a structural plural array).
   */
  familyOf?(key: string): { familyKey: string; role: string } | undefined;
}

export interface PluralSelector {
  /** Which CLDR categories the document's target locale actually uses, in canonical order. */
  categoriesFor(doc: TranslationDocument): PluralCategory[];
  /** Selects the category for a runtime number n under the document's target locale. */
  select(n: number, doc: TranslationDocument): PluralCategory;
}

export interface StatusStrategy {
  fromNative(entry: TranslationEntry, nativeState: unknown): TranslationEntry["status"];
  toNative(entry: TranslationEntry, status: TranslationEntry["status"]): unknown;
}

export interface LocaleMeta {
  /** As today's codeFromFilename. */
  defaultTargetLocaleHint?: string;
  numberFormat?: Intl.NumberFormatOptions;
  dateFormat?: Intl.DateTimeFormatOptions;
  /** Reserved for future use — not consumed by any MVP loader. */
  genderCategories?: string[];
}

export interface GameLoader<TRaw = unknown> {
  id: string;
  displayName: string;
  icon?: string;
  fileLoaderId: string;
  requiredFiles: RequiredFile[];
  /** For the placeholder-legend UI. */
  legend?: { kind: string; color: string; labelKey: string }[];

  /** Auto-detect score (0..1) from the given file set. */
  detectGame(input: FileLoaderInput): number;
  toDocument(raw: TRaw, roles: { role: string }[]): TranslationDocument;
  fromDocument(doc: TranslationDocument): TRaw;

  /**
   * Each token is classified as "required" (a value substitution — must round-trip,
   * validation blocks on a missing instance) or "formatting" (a stylistic/reference
   * marker the translator may freely add, drop, or rearrange — validation only warns
   * if a kind present in source is entirely absent from target). See PlaceholderSeverity.
   */
  placeholders: PlaceholderTokenizer;
  /**
   * Absent = the format has no plural concept at all (Necesse, generic-ini, ...),
   * or plurals are a value-level sub-grammar inside a single string (Factorio) that
   * this structure doesn't model. Not "one category" — "plurals don't exist here".
   */
  pluralSelector?: PluralSelector;
  statusStrategy: StatusStrategy;
  locale: LocaleMeta;
  /** Absent = the core falls back to defaultIdentityStrategy(). */
  identity?: EntryIdentityStrategy;
}
