// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImportedMod } from "@mgt/sdk";

/**
 * Standalone build: one offline HTML file, no server to fetch a catalog
 * from. Reuses the exact same loadModCatalog() mechanism as the web build
 * (see mod-bootstrap.ts) — just fed a build-time-embedded catalog and a
 * static map of literal `import("@mgt/mod-necesse")` specifiers instead of
 * real HTTP. Because that specifier is a literal string (not a
 * runtime-computed URL), Rollup's `inlineDynamicImports` can trace and
 * inline it into the single output chunk — this file is only reachable from
 * the "standalone" mode's module graph (see vite.config.ts's
 * mode-conditional alias); the web build's module graph never mentions
 * "@mgt/mod-necesse" anywhere, which is the actual point of the cutover.
 *
 * Future desktop/Tauri pre-installed mods become a third mod-source module
 * here, with no change to mod-bootstrap.ts or the registry.
 */
const STANDALONE_MODS: Record<string, () => Promise<ImportedMod>> = {
  necesse: () => import("@mgt/mod-necesse"),
  factorio: () => import("@mgt/mod-factorio"),
};

const STANDALONE_CATALOG = {
  format: "mgt-mod-catalog",
  version: 1,
  mods: Object.keys(STANDALONE_MODS).map((id) => ({
    id,
    name: id,
    icon: "",
    version: "0.0.1",
    entry: `standalone:${id}`,
    sdkRange: "^0.0.1",
    enabled: true,
  })),
};

export const modSource = {
  catalogUrl: "standalone://catalog.json",
  async fetchImpl() {
    return {
      async json() {
        return STANDALONE_CATALOG;
      },
    };
  },
  async importModule(url: string): Promise<ImportedMod> {
    const id = url.replace(/^standalone:/, "");
    const load = STANDALONE_MODS[id];
    if (!load) throw new Error(`No bundled standalone mod for "${id}"`);
    return load();
  },
};
