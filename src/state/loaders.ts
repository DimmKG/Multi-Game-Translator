// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  getFileLoader,
  getGameLoader,
  getGameLoaders,
  TRANSLATION_ROLE,
  type FileLoader,
  type GameLoader,
} from "@mgt/sdk";

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

export function resolveFileLoader(fileLoaderId: string): FileLoader {
  const loader = getFileLoader(fileLoaderId);
  if (!loader) throw new Error(`Unknown file loader id: "${fileLoaderId}"`);
  return loader;
}

/**
 * The dropzone's second slot, whatever it's called — REFERENCE_ROLE for
 * Necesse/generic-ini/Factorio, gettext's own "template" for its .pot. Only
 * TRANSLATION_ROLE/REFERENCE_ROLE are fixed by the SDK; any other role name
 * is entirely up to the mod, so this is derived rather than hardcoded, to
 * work for any loader whose second role isn't REFERENCE_ROLE.
 */
export function auxRoleOf(loader: GameLoader): string | undefined {
  return loader.requiredFiles.find((rf) => rf.role !== TRANSLATION_ROLE)?.role;
}
