// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import { createModSdk, getGameLoader } from "./registry";
import { isSdkRangeCompatible, loadModCatalog, type FetchLike } from "./catalog-loader";

function fakeFetch(mods: unknown[]): FetchLike {
  return async () => ({
    async json() {
      return { format: "mgt-mod-catalog", version: 1, mods };
    },
  });
}

/**
 * normalizeModCatalog resolves each entry's `entry` field against the catalog's
 * own URL (baseUrl) — real, load-bearing behavior for the deployed catalog.json.
 * To exercise a genuine dynamic import() of the on-disk fixtures below, the
 * fake catalog "lives" at test/fixtures/catalog.json, so entry values can just
 * be fixture-relative paths, exactly like the real catalog's entries are
 * relative to its own deployed location.
 */
const FIXTURES_CATALOG_URL = new URL("../test/fixtures/catalog.json", import.meta.url).href;

describe("isSdkRangeCompatible", () => {
  it("accepts a matching major version", () => {
    expect(isSdkRangeCompatible("^0.0.1", "0.0.1")).toBe(true);
    expect(isSdkRangeCompatible("^0.9.0", "0.0.1")).toBe(true);
  });

  it("rejects a mismatched major version", () => {
    expect(isSdkRangeCompatible("^1.0.0", "0.0.1")).toBe(false);
  });

  it("rejects a malformed range without throwing", () => {
    expect(isSdkRangeCompatible("latest", "0.0.1")).toBe(false);
    expect(isSdkRangeCompatible("", "0.0.1")).toBe(false);
  });
});

describe("loadModCatalog", () => {
  it("loads a good mod and isolates a throwing register() and a missing module in the same catalog", async () => {
    const sdk = createModSdk();
    const outcome = await loadModCatalog({
      catalogUrl: FIXTURES_CATALOG_URL,
      sdk,
      fetchImpl: fakeFetch([
        {
          id: "toy",
          name: "Toy",
          version: "1.0.0",
          entry: "toy-mod/index.ts",
          sdkRange: "^0.0.1",
        },
        {
          id: "toy-broken",
          name: "Toy Broken",
          version: "1.0.0",
          entry: "toy-mod-broken/index.ts",
          sdkRange: "^0.0.1",
        },
        {
          id: "toy-missing",
          name: "Toy Missing",
          version: "1.0.0",
          entry: "does-not-exist/index.ts",
          sdkRange: "^0.0.1",
        },
      ]),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const statuses = Object.fromEntries(outcome.results.map((r) => [r.entry.id, r.status]));
    expect(statuses).toEqual({ toy: "loaded", "toy-broken": "failed", "toy-missing": "failed" });
    expect(getGameLoader("toy")?.id).toBe("toy");
  });

  it("skips an sdkRange-incompatible entry without ever importing it", async () => {
    const sdk = createModSdk();
    const importModule = vi.fn();
    const outcome = await loadModCatalog({
      catalogUrl: "https://example.invalid/catalog.json",
      sdk,
      fetchImpl: fakeFetch([
        {
          id: "toy-incompatible",
          name: "Toy Incompatible",
          version: "1.0.0",
          entry: "unused",
          sdkRange: "^99.0.0",
        },
      ]),
      importModule,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.results[0]?.status).toBe("skipped");
    expect(importModule).not.toHaveBeenCalled();
  });

  it("returns a non-throwing failure when the catalog itself can't be fetched/parsed", async () => {
    const sdk = createModSdk();
    const outcome = await loadModCatalog({
      catalogUrl: "https://example.invalid/catalog.json",
      sdk,
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });

    expect(outcome).toEqual({ ok: false, reason: "network down" });
  });
});
