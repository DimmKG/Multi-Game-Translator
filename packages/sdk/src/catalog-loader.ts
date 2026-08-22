// SPDX-License-Identifier: LGPL-3.0-or-later
import { normalizeModCatalog, type CatalogModEntry } from "./catalog";
import type { ModSdk } from "./registry";

const CARET_RANGE = /^\^(\d+)\.\d+\.\d+$/;

/**
 * Minimal major-version compatibility check — not a full semver range parser.
 * Everything in this SDK is pre-1.0 today (every package is 0.0.x), so this
 * is intentionally permissive; real range enforcement only starts to matter
 * once the SDK crosses 1.0. An unrecognized range shape is treated as
 * incompatible rather than throwing, so one malformed catalog entry can't
 * crash the whole load.
 */
export function isSdkRangeCompatible(sdkRange: string, hostVersion: string): boolean {
  const range = CARET_RANGE.exec(sdkRange);
  const host = /^(\d+)\.\d+\.\d+/.exec(hostVersion);
  if (!range || !host) return false;
  return range[1] === host[1];
}

export type ImportedMod = { default?: (sdk: ModSdk) => void | Promise<void> };

/** Narrow enough to inject a fake in tests; a real `fetch` response satisfies it. */
export type FetchLike = (url: string) => Promise<{ json(): Promise<unknown> }>;
export type ImportModuleLike = (url: string) => Promise<ImportedMod>;

export interface ModLoadResult {
  entry: CatalogModEntry;
  status: "loaded" | "skipped" | "failed";
  reason?: string;
}

export interface LoadModCatalogOptions {
  catalogUrl: string;
  sdk: ModSdk;
  fetchImpl?: FetchLike;
  importModule?: ImportModuleLike;
}

export type CatalogLoadOutcome =
  { ok: true; results: ModLoadResult[] } | { ok: false; reason: string };

function defaultImportModule(url: string): Promise<ImportedMod> {
  return import(/* @vite-ignore */ url);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fetches + normalizes a mod catalog, then `import()`s and `register(sdk)`s
 * every enabled, sdkRange-compatible entry. A single broken/incompatible mod
 * never breaks the others: `loadOne` below never rejects, so the plain
 * `Promise.all` still resolves per-entry results instead of failing wholesale.
 * Only a catalog-level failure (fetch/parse/shape) short-circuits the whole
 * call, since there's nothing to iterate at that point.
 */
export async function loadModCatalog(options: LoadModCatalogOptions): Promise<CatalogLoadOutcome> {
  const { catalogUrl, sdk } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const importModule = options.importModule ?? defaultImportModule;

  let mods: readonly CatalogModEntry[];
  try {
    const response = await fetchImpl(catalogUrl);
    const json = await response.json();
    mods = normalizeModCatalog(json, catalogUrl).mods;
  } catch (error) {
    return { ok: false, reason: errorMessage(error) };
  }

  async function loadOne(entry: CatalogModEntry): Promise<ModLoadResult> {
    if (!entry.enabled) return { entry, status: "skipped", reason: "disabled" };
    if (!isSdkRangeCompatible(entry.sdkRange, sdk.version)) {
      return {
        entry,
        status: "skipped",
        reason: `sdkRange "${entry.sdkRange}" incompatible with host SDK ${sdk.version}`,
      };
    }
    try {
      const mod = await importModule(entry.entry);
      if (typeof mod.default !== "function") {
        return {
          entry,
          status: "failed",
          reason: `Mod "${entry.id}" does not export a default register(sdk) function.`,
        };
      }
      await mod.default(sdk);
      return { entry, status: "loaded" };
    } catch (error) {
      return { entry, status: "failed", reason: errorMessage(error) };
    }
  }

  const results = await Promise.all(mods.map(loadOne));
  return { ok: true, results };
}
