// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GameLoader } from "@mgt/sdk";
import { necesseGameLoader } from "@mgt/mod-necesse";
import { genericIniGameLoader } from "@mgt/mod-generic-ini";

/**
 * Static, host-hardcoded list — the ONE place src/ hardcodes which loaders
 * exist, until a real dynamic-import mod registry lands (see
 * packages/sdk/src/registry.ts, currently unused by src/). Order here is the
 * game-selection screen's display order.
 */
export const AVAILABLE_GAME_LOADERS: readonly GameLoader[] = [
  necesseGameLoader,
  genericIniGameLoader,
];

export function resolveGameLoader(gameLoaderId: string): GameLoader {
  const loader = AVAILABLE_GAME_LOADERS.find((candidate) => candidate.id === gameLoaderId);
  if (!loader) throw new Error(`Unknown game loader id: "${gameLoaderId}"`);
  return loader;
}
