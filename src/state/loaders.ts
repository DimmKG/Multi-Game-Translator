// SPDX-License-Identifier: AGPL-3.0-or-later
import { getGameLoader, getGameLoaders, type GameLoader } from "@mgt/sdk";

/**
 * Thin wrapper over the SDK registry — populated at boot by
 * src/state/mod-bootstrap.ts, not hardcoded here anymore.
 */
export function availableGameLoaders(): readonly GameLoader[] {
  return getGameLoaders();
}

export function resolveGameLoader(gameLoaderId: string): GameLoader {
  const loader = getGameLoader(gameLoaderId);
  if (!loader) throw new Error(`Unknown game loader id: "${gameLoaderId}"`);
  return loader;
}
