// SPDX-License-Identifier: LGPL-3.0-or-later

const CATALOG_FORMAT = "mgt-mod-catalog";
const CATALOG_FORMAT_VERSION = 1;

export interface CatalogModEntry {
  id: string;
  name: string;
  icon: string;
  version: string;
  /** import()-able URL, absolute once resolved against baseUrl. */
  entry: string;
  sdkRange: string;
  enabled: boolean;
}

export interface ModCatalog {
  format: typeof CATALOG_FORMAT;
  version: typeof CATALOG_FORMAT_VERSION;
  mods: readonly CatalogModEntry[];
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

/**
 * Validates and normalizes a fetched mod catalog manifest. Pure/stateless —
 * fetching lives in the bootstrap sequence (Phase 7), not here.
 */
export function normalizeModCatalog(input: unknown, baseUrl?: string): ModCatalog {
  assertObject(input, "Mod catalog");
  if (input.format !== CATALOG_FORMAT || input.version !== CATALOG_FORMAT_VERSION) {
    throw new TypeError("Unsupported mod catalog format or version.");
  }
  if (!Array.isArray(input.mods)) throw new TypeError("Catalog mods must be an array.");

  const ids = new Set<string>();
  const mods = input.mods.map((item, index) => {
    assertObject(item, `mods[${index}]`);
    assertNonEmptyString(item.id, `mods[${index}].id`);
    if (ids.has(item.id)) throw new TypeError(`Duplicate mod id: ${item.id}`);
    ids.add(item.id);
    assertNonEmptyString(item.name, `mods[${index}].name`);
    assertNonEmptyString(item.version, `mods[${index}].version`);
    assertNonEmptyString(item.entry, `mods[${index}].entry`);
    assertNonEmptyString(item.sdkRange, `mods[${index}].sdkRange`);
    return Object.freeze({
      id: item.id,
      name: item.name,
      icon: (item.icon as string | undefined) ?? "",
      version: item.version,
      entry: baseUrl ? new URL(item.entry, baseUrl).href : item.entry,
      sdkRange: item.sdkRange,
      enabled: (item.enabled as boolean | undefined) ?? true,
    });
  });

  return Object.freeze({
    format: CATALOG_FORMAT,
    version: CATALOG_FORMAT_VERSION,
    mods: Object.freeze(mods),
  });
}
