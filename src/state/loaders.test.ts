// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { GameLoader } from "@mgt/sdk";
import { auxRoleOf } from "@/state/loaders";

function fakeLoader(roles: string[]): GameLoader {
  return {
    id: "fake",
    displayName: "Fake",
    fileLoaderId: "ini",
    fileExtension: ".fake",
    requiredFiles: roles.map((role) => ({
      role,
      labelKey: `${role}.label`,
      required: true,
      accept: [],
    })),
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
  };
}

describe("auxRoleOf", () => {
  it("finds the non-translation role, whatever it's named", () => {
    expect(auxRoleOf(fakeLoader(["translation", "reference"]))).toBe("reference");
    // A loader whose second role isn't literally "reference" (e.g. gettext's
    // .pot "template") — the New-Translation/attach-reference flows must
    // still find it via this derived lookup, not a hardcoded string.
    expect(auxRoleOf(fakeLoader(["translation", "template"]))).toBe("template");
  });

  it("returns undefined when there's no second role", () => {
    expect(auxRoleOf(fakeLoader(["translation"]))).toBeUndefined();
  });
});
