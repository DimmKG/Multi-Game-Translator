// SPDX-License-Identifier: LGPL-3.0-or-later
import type { ModSdk } from "../../../src/registry";

/** Throwaway fixture proving the fetch/import()/register(sdk) mechanism — never shipped. */
export default function register(sdk: ModSdk): void {
  sdk.registerGameLoader({
    id: "toy",
    displayName: "Toy",
    fileLoaderId: "ini",
    fileExtension: ".toy",
    requiredFiles: [],
    detectGame: () => 0,
    toDocument: () => {
      throw new Error("not implemented");
    },
    fromDocument: () => {
      throw new Error("not implemented");
    },
    applyEntryPatch: (entry, patch) => ({ ...entry, target: patch.target ?? entry.target }),
    placeholders: { tokenize: () => [] },
    statusStrategy: {
      fromNative: (entry) => entry.status,
      toNative: (_entry, status) => status,
    },
    locale: {},
  });
}
