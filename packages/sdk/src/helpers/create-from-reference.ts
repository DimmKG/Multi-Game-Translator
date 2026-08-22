// SPDX-License-Identifier: LGPL-3.0-or-later
import type { FileLoader, FileLoaderInput } from "../file-loader";
import { REFERENCE_ROLE, TRANSLATION_ROLE, type GameLoader } from "../game-loader";
import type { TranslationDocument } from "../model/document";

/**
 * Generic fallback for GameLoader.createFromReference, for loaders that don't
 * provide a more precise implementation: re-serializes the reference raw back
 * to text, feeds an identical copy of that same file in as the initial
 * "translation" input, and re-parses both through toDocument. Goes through a
 * real serialize→parse round-trip (rather than reusing the already-parsed
 * TRaw directly) because TRaw is opaque per File Loader — this is the only
 * generically safe way to produce a second, independent "file" input without
 * knowing that shape.
 *
 * Whether a freshly-duplicated entry reads as "missing" or "translated"
 * depends entirely on how that loader's statusStrategy treats target ===
 * source with no other native signal. A format with an explicit "still
 * untranslated" marker (e.g. Necesse's MISSING_TRANSLATION: prefix) needs
 * that marker to be present for its own status logic to recognize it, which
 * this generic helper has no way to inject — such loaders should implement
 * their own createFromReference instead of relying on this default.
 *
 * Only applies to formats with a genuine reference/translation file split.
 * Single-file source+target formats (e.g. gettext/PO, where each entry
 * already carries msgid and msgstr in the one file) have no separate
 * reference file to duplicate — this helper doesn't apply to them at all;
 * such loaders build a draft directly from the one file instead.
 */
export function createDraftFromReference<TRaw>(
  fileLoader: FileLoader<TRaw>,
  gameLoader: GameLoader<TRaw>,
  referenceRaw: TRaw,
  targetLocale: string,
  roles: { role: string }[] = [{ role: REFERENCE_ROLE }, { role: TRANSLATION_ROLE }],
): TranslationDocument {
  const referenceInput = fileLoader.serialize(referenceRaw);
  const referenceFile = referenceInput.files[0];
  if (!referenceFile) {
    throw new Error("createDraftFromReference requires a reference file.");
  }
  const combinedInput: FileLoaderInput = { files: [referenceFile, referenceFile] };
  const raw = fileLoader.parse(combinedInput);
  return gameLoader.toDocument(raw, roles, targetLocale);
}
