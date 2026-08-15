// SPDX-License-Identifier: LGPL-3.0-or-later
import type { PluralCategory } from "../model/document";
import type { PluralSelector } from "../game-loader";

/** Canonical CLDR ordering — Intl.PluralRules returns categories unordered. */
const CANONICAL_ORDER: readonly PluralCategory[] = ["zero", "one", "two", "few", "many", "other"];

/**
 * Default PluralSelector for any format whose plurals are natively CLDR
 * categories (most formats except gettext, which needs its own bridging —
 * see the gettext Game Loader). Wraps Intl.PluralRules.
 */
export function createCldrPluralSelector(): PluralSelector {
  const cache = new Map<string, Intl.PluralRules>();
  function rulesFor(locale: string): Intl.PluralRules {
    let rules = cache.get(locale);
    if (!rules) {
      rules = new Intl.PluralRules(locale);
      cache.set(locale, rules);
    }
    return rules;
  }
  return {
    categoriesFor(doc) {
      const categories = new Set(
        rulesFor(doc.targetLocale).resolvedOptions().pluralCategories as PluralCategory[],
      );
      return CANONICAL_ORDER.filter((category) => categories.has(category));
    },
    select(n, doc) {
      return rulesFor(doc.targetLocale).select(n) as PluralCategory;
    },
  };
}
