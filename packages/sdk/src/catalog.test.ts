// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { normalizeModCatalog } from "./catalog";

function validCatalog() {
  return {
    format: "mgt-mod-catalog",
    version: 1,
    mods: [
      {
        id: "necesse",
        name: "Necesse",
        version: "1.0.0",
        entry: "mods/necesse/index.js",
        sdkRange: "^1.0.0",
      },
    ],
  };
}

describe("normalizeModCatalog", () => {
  it("normalizes a valid catalog, defaulting icon/enabled", () => {
    const catalog = normalizeModCatalog(validCatalog());
    expect(catalog.mods).toEqual([
      {
        id: "necesse",
        name: "Necesse",
        icon: "",
        version: "1.0.0",
        entry: "mods/necesse/index.js",
        sdkRange: "^1.0.0",
        enabled: true,
      },
    ]);
  });

  it("resolves entry URLs against a baseUrl", () => {
    const catalog = normalizeModCatalog(validCatalog(), "https://example.github.io/catalog.json");
    expect(catalog.mods[0]?.entry).toBe("https://example.github.io/mods/necesse/index.js");
  });

  it("rejects an unsupported format or version", () => {
    expect(() => normalizeModCatalog({ ...validCatalog(), format: "other" })).toThrow(
      /Unsupported/,
    );
    expect(() => normalizeModCatalog({ ...validCatalog(), version: 2 })).toThrow(/Unsupported/);
  });

  it("rejects a duplicate mod id", () => {
    const catalog = validCatalog();
    catalog.mods.push({ ...catalog.mods[0] });
    expect(() => normalizeModCatalog(catalog)).toThrow(/Duplicate mod id/);
  });

  it("respects an explicit enabled: false", () => {
    const catalog = validCatalog();
    (catalog.mods[0] as { enabled?: boolean }).enabled = false;
    expect(normalizeModCatalog(catalog).mods[0]?.enabled).toBe(false);
  });
});
