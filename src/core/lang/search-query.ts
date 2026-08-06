// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Normalize a list search query.
 *
 * Ordinary text is trimmed so accidental leading/trailing spaces do not hide
 * matches. Whitespace-only queries (e.g. `"  "` from the double-space button)
 * are kept intact — trimming them would clear the search entirely.
 */
export function normalizeSearchQuery(raw: string): string {
  const trimmed = raw.trim();
  return (trimmed || raw).toLowerCase();
}
