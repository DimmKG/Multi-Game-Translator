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
  validate?(file: {
    name: string;
    text: string;
  }): { ok: true; displayName?: string } | { ok: false; messageKey: string };
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

/**
 * Extra per-entry facts a loader's native model tracks that the core entry
 * shape has no field for (Necesse's markedSame/wasMissing/originalValue and
 * matched-reference text being the motivating case) — read-only, for UI
 * display and gating. Absent method (no entryUiHints at all) = this loader
 * exposes none of these; an absent *field* on a returned hint object = this
 * loader's format has no such concept for this entry, not "false"/"unset".
 */
export interface EntryUiHints {
  originalValue?: string;
  referenceText?: string;
  markedSame?: boolean;
  wasMissing?: boolean;
}

/** Fields a host-initiated edit action may update; a given loader may support only some. */
export interface EntryPatch {
  target?: string;
  markedSame?: boolean;
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
  /**
   * Semantic hint for the game-selection screen's icon — not a literal icon
   * name/URL. Absent = "a specific game" (the host's default treatment,
   * e.g. a gamepad icon). `"generic"` = this loader isn't tied to any one
   * game (e.g. generic-ini) and should read visually distinct from the
   * actual game loaders in the list.
   */
  icon?: "generic";
  fileLoaderId: string;
  /** Canonical extension for exported/downloaded files, including the leading dot (e.g. ".lang" for Necesse, ".ini" for generic-ini) — the host never guesses this from an id string. */
  fileExtension: string;
  requiredFiles: RequiredFile[];
  /** For the placeholder-legend UI. */
  legend?: { kind: string; color: string; labelKey: string }[];

  /** Auto-detect score (0..1) from the given file set. */
  detectGame(input: FileLoaderInput): number;
  /**
   * `targetLocale` is never guessed by the loader — filename-based detection
   * is unreliable (nothing stops a translator naming their file whatever they
   * like), so the host must ask the translator and pass the confirmed value
   * in. `locale.defaultTargetLocaleHint` exists purely to pre-fill that
   * prompt, not to feed this call.
   */
  toDocument(raw: TRaw, roles: { role: string }[], targetLocale: string): TranslationDocument;
  fromDocument(doc: TranslationDocument): TRaw;
  /**
   * Optional: build a blank TranslationDocument from just a reference file (no
   * translation file yet) — every entry starts in whatever "untranslated" state
   * this format uses. Absent = this loader has no notion of starting a
   * translation from a reference alone; the host's "create new" UI action is
   * unavailable for this game. `referenceRaw` is whatever this loader's
   * fileLoaderId produced for the reference file alone (same shape as toDocument's
   * `raw`, just parsed from a single file). `targetLocale` is the translator's
   * confirmed choice, same as for toDocument — never guessed here either.
   */
  createFromReference?(referenceRaw: TRaw, targetLocale: string): TranslationDocument;

  /**
   * Absent = this loader exposes none of the optional per-entry UI hints
   * (originalValue/referenceText/markedSame/wasMissing) — the host falls
   * back to defaults that keep every UI affordance built on them (e.g.
   * "mark same") hidden rather than guessing.
   */
  entryUiHints?(entry: TranslationEntry): EntryUiHints;

  /**
   * Applies a host-initiated edit and returns the updated entry with status
   * recomputed the same way toDocument would — every loader owns its own
   * edit+status-recompute logic, since only it knows which native fields
   * (e.g. Necesse's markedSame) participate in status. REQUIRED: there is no
   * generic notion of "just overwrite target", because status is never
   * purely a function of target alone.
   */
  applyEntryPatch(entry: TranslationEntry, patch: EntryPatch): TranslationEntry;

  /**
   * Optional: attach or replace a reference file on a document that's
   * already open — pure document-in/document-out (no host/UI concerns).
   * Absent = this loader has no "add a reference later" workflow, e.g.
   * because it requires its reference at open time (generic-ini). Mirrors
   * createFromReference's targetLocale-is-never-guessed-here rule: nothing
   * here is inferred, only re-matched against what the document already carries.
   */
  attachReference?(document: TranslationDocument, referenceRaw: TRaw): TranslationDocument;

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
