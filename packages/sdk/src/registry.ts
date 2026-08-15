// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FileLoader } from "./file-loader";
import type { GameLoader } from "./game-loader";

/**
 * The only thing that travels through the register(sdk) runtime channel: functions
 * that mutate state shared with the host. Everything else in the SDK is a stateless
 * `import` from "@mgt/sdk" — a mod is an ordinary TS/JS project with a normal
 * build-time dependency on the SDK for types and pure helpers.
 */
export interface ModSdk {
  registerFileLoader(loader: FileLoader): void;
  registerGameLoader(loader: GameLoader): void;
  /** Actual host SDK version, for diagnostics inside the mod. */
  version: string;
}

const fileLoaders = new Map<string, FileLoader>();
const gameLoaders = new Map<string, GameLoader>();

function requireId(id: unknown, what: string): string {
  if (typeof id !== "string" || !id.trim()) {
    throw new TypeError(`A ${what} id is required.`);
  }
  return id.trim();
}

export function registerFileLoader(loader: FileLoader): FileLoader {
  const id = requireId(loader?.id, "file loader");
  if (fileLoaders.has(id)) throw new TypeError(`Duplicate file loader: ${id}`);
  const frozen = Object.freeze({ ...loader, id });
  fileLoaders.set(id, frozen);
  return frozen;
}

export function registerGameLoader(loader: GameLoader): GameLoader {
  const id = requireId(loader?.id, "game loader");
  if (gameLoaders.has(id)) throw new TypeError(`Duplicate game loader: ${id}`);
  const frozen = Object.freeze({ ...loader, id });
  gameLoaders.set(id, frozen);
  return frozen;
}

export function getFileLoader(id: string): FileLoader | undefined {
  return fileLoaders.get(id);
}

export function getGameLoader(id: string): GameLoader | undefined {
  return gameLoaders.get(id);
}

export function getFileLoaders(): readonly FileLoader[] {
  return [...fileLoaders.values()];
}

export function getGameLoaders(): readonly GameLoader[] {
  return [...gameLoaders.values()];
}
