// SPDX-License-Identifier: AGPL-3.0-or-later
import { createModSdk, loadModCatalog } from "@mgt/sdk";
import registerGenericIni from "@mgt/mod-generic-ini";
import { modSource } from "@/state/mod-source";
import type { ModLoadWarning } from "@/state/mod-bootstrap-warnings";

export interface ModBootstrapResult {
  failed: readonly ModLoadWarning[];
}

/**
 * Registers every available game loader. generic-ini is always static (no
 * network, per Fork B — a general-purpose loader must work fully offline).
 * Necesse (and any future game-specific mod) goes through loadModCatalog(),
 * fed by whichever mod-source the current build resolves to — see
 * vite.config.ts's mode-conditional "@/state/mod-source" alias.
 */
export async function bootstrapMods(): Promise<ModBootstrapResult> {
  const sdk = createModSdk();
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
