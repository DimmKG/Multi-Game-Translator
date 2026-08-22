// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluralCategory } from "@mgt/sdk";

const cache = new Map<string, Partial<Record<PluralCategory, number[]>>>();

/**
 * Up to 3 example integers (0..100) that select each of the locale's plural
 * categories — a translator unfamiliar with CLDR terminology ("few" isn't
 * "small numbers", it's whatever numbers the locale's grammar buckets
 * together) reads examples far more reliably than the category name alone.
 * Cached per locale since every card sharing a target locale would otherwise
 * recompute this on every render.
 */
export function pluralCategoryExamples(locale: string): Partial<Record<PluralCategory, number[]>> {
  const cached = cache.get(locale);
  if (cached) return cached;
  let rules: Intl.PluralRules;
  try {
    rules = new Intl.PluralRules(locale);
  } catch {
    return {};
  }
  const examples: Partial<Record<PluralCategory, number[]>> = {};
  for (let n = 0; n <= 100; n++) {
    const category = rules.select(n) as PluralCategory;
    const list = examples[category] ?? (examples[category] = []);
    if (list.length < 3) list.push(n);
  }
  cache.set(locale, examples);
  return examples;
}
