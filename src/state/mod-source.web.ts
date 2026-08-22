// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The real web build: fetches the mod catalog and dynamically import()s each
 * entry's URL. loadModCatalog()'s default fetch/import(url) do the actual
 * work — this just supplies where the catalog lives.
 *
 * Must be an ABSOLUTE URL: normalizeModCatalog() uses it as the baseUrl to
 * resolve each entry's relative `entry` field (new URL(entry, baseUrl)),
 * which throws on a relative base. document.baseURI respects Vite's
 * `base: "./"` (works under a GitHub Pages subpath, standalone-irrelevant
 * since this module is never reachable from that build's graph).
 */
export const modSource = {
  catalogUrl: new URL("./mods/catalog.json", document.baseURI).href,
};
