// SPDX-License-Identifier: AGPL-3.0-or-later

export interface ModLoadWarning {
  scope: "catalog" | "mod";
  id?: string;
  reason: string;
}

/**
 * Set once by main.tsx right after bootstrapMods() resolves, read once by
 * WorkspaceShell on mount. Deliberately not React state/context: this is
 * fixed boot-time data, settled before the tree ever renders — not
 * something that changes over the app's lifetime.
 */
let warnings: readonly ModLoadWarning[] = [];

export function setModLoadWarnings(next: readonly ModLoadWarning[]): void {
  warnings = next;
}

export function getModLoadWarnings(): readonly ModLoadWarning[] {
  return warnings;
}
