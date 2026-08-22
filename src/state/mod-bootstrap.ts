// SPDX-License-Identifier: AGPL-3.0-or-later
import { createModSdk, iniFileLoader, loadModCatalog, poFileLoader } from "@mgt/sdk";
import registerGenericIni from "@mgt/mod-generic-ini";
import { modSource } from "@/state/mod-source";
import type { ModLoadWarning } from "@/state/mod-bootstrap-warnings";

export interface ModBootstrapResult {
  failed: readonly ModLoadWarning[];
}

/**
 * Registers every available game/file loader. File Loaders and generic-ini
 * are always static (no network, per Fork B — general-purpose infrastructure
 * must work fully offline). Game-specific mods (Necesse and friends) go
 * through loadModCatalog(), fed by whichever mod-source the current build
 * resolves to — see vite.config.ts's mode-conditional "@/state/mod-source"
 * alias.
 */
export async function bootstrapMods(): Promise<ModBootstrapResult> {
  const sdk = createModSdk();
  sdk.registerFileLoader(iniFileLoader);
  sdk.registerFileLoader(poFileLoader);
  registerGenericIni(sdk);

  const outcome = await loadModCatalog({ ...modSource, sdk });
  if (!outcome.ok) {
    return { failed: [{ scope: "catalog", reason: outcome.reason }] };
  }

  const failed: ModLoadWarning[] = outcome.results
    .filter((result) => result.status === "failed")
    .map((result) => ({
      scope: "mod",
      id: result.entry.id,
      reason: result.reason ?? "unknown error",
    }));

  return { failed };
}
