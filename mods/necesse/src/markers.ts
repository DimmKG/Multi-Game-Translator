// SPDX-License-Identifier: AGPL-3.0-or-later

export const MISSING_TRANSLATION_PREFIX = "MISSING_TRANSLATION:";
export const SAME_TRANSLATION_PREFIX = "SAME_TRANSLATION:";

/** Strips a status prefix (if any) from an ini pair's key, same as today's parseLangFile. */
export function stripStatusPrefix(key: string): {
  key: string;
  markedSame: boolean;
  wasMissing: boolean;
} {
  if (key.startsWith(MISSING_TRANSLATION_PREFIX)) {
    return {
      key: key.slice(MISSING_TRANSLATION_PREFIX.length),
      markedSame: false,
      wasMissing: true,
    };
  }
  if (key.startsWith(SAME_TRANSLATION_PREFIX)) {
    return { key: key.slice(SAME_TRANSLATION_PREFIX.length), markedSame: true, wasMissing: false };
  }
  return { key, markedSame: false, wasMissing: false };
}
