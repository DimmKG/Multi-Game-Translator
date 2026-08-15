// SPDX-License-Identifier: LGPL-3.0-or-later

const LANGUAGE_DISPLAY_NAMES = new Intl.DisplayNames(["en"], {
  type: "language",
  fallback: "code",
});

/**
 * Intl.getCanonicalLocales only checks BCP-47 grammar (2-3 ALPHA "looks like
 * a language subtag"), not whether that subtag is an actually assigned ISO
 * 639 code — "xx.lang" is grammatically fine but not a real language. Cross-
 * check against the runtime's own CLDR language-name data instead of hand-
 * maintaining a code list: a recognized tag gets a real display name back,
 * an unrecognized one just echoes the code (fallback: "code").
 */
function isRecognizedLocale(tag: string): string | undefined {
  let canonical: string[];
  try {
    canonical = Intl.getCanonicalLocales(tag);
  } catch {
    return undefined;
  }
  const candidate = canonical[0];
  if (!candidate) return undefined;
  try {
    if (LANGUAGE_DISPLAY_NAMES.of(candidate) === candidate) return undefined;
  } catch {
    return undefined;
  }
  return candidate;
}

/**
 * Best-effort ISO/BCP-47 locale guess from an uploaded filename (e.g.
 * "ru.lang", "de_DE.po", "translation.ru.lang"). Not authoritative — a
 * coincidental match (a real language code that just isn't what the
 * translator meant) is possible, so this is a pre-fill/suggestion the
 * translator should be able to confirm or override, never a silently
 * trusted final answer. Returns undefined when nothing in the filename
 * recognizably parses as a locale — callers should fall back to asking
 * the translator directly (and remembering the answer for next time).
 */
export function detectIsoLocaleFromFilename(filename: string): string | undefined {
  const base = String(filename || "")
    .trim()
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "");
  if (!base) return undefined;

  const whole = isRecognizedLocale(base.replace(/_/g, "-"));
  if (whole) return whole;

  for (const segment of base.split(/[._-]+/).filter(Boolean)) {
    const match = isRecognizedLocale(segment);
    if (match) return match;
  }
  return undefined;
}
