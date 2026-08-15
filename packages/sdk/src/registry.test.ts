// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { FileLoaderInput } from "./file-loader";
import type { GameLoader } from "./game-loader";
import {
  getFileLoader,
  getFileLoaders,
  getGameLoader,
  getGameLoaders,
  registerFileLoader,
  registerGameLoader,
} from "./registry";

function fakeFileLoader(id: string) {
  return {
    id,
    displayName: id,
    extensions: [".txt"],
    detect: () => 0,
    parse: (input: FileLoaderInput) => input,
    serialize: (raw: FileLoaderInput) => raw,
  };
}

function fakeGameLoader(id: string): GameLoader {
  return {
    id,
    displayName: id,
    fileLoaderId: "ini",
    requiredFiles: [],
    detectGame: () => 0,
    toDocument: () => {
      throw new Error("not implemented");
    },
    fromDocument: () => {
      throw new Error("not implemented");
    },
    placeholders: { tokenize: () => [] },
    statusStrategy: {
      fromNative: (entry) => entry.status,
      toNative: (_entry, status) => status,
    },
    locale: {},
  };
}

describe("registry", () => {
  it("registers and looks up file loaders by id", () => {
    registerFileLoader(fakeFileLoader("registry-test-ini"));
    expect(getFileLoader("registry-test-ini")?.id).toBe("registry-test-ini");
    expect(getFileLoaders().some((loader) => loader.id === "registry-test-ini")).toBe(true);
  });

  it("registers and looks up game loaders by id", () => {
    registerGameLoader(fakeGameLoader("registry-test-necesse"));
    expect(getGameLoader("registry-test-necesse")?.id).toBe("registry-test-necesse");
    expect(getGameLoaders().some((loader) => loader.id === "registry-test-necesse")).toBe(true);
  });

  it("rejects a duplicate loader id", () => {
    registerFileLoader(fakeFileLoader("registry-test-dup"));
    expect(() => registerFileLoader(fakeFileLoader("registry-test-dup"))).toThrow(/Duplicate/);
  });

  it("rejects a missing or blank id", () => {
    expect(() => registerFileLoader(fakeFileLoader(""))).toThrow(/id is required/);
    expect(() => registerFileLoader(fakeFileLoader("   "))).toThrow(/id is required/);
  });

  it("freezes the registered loader", () => {
    const registered = registerFileLoader(fakeFileLoader("registry-test-frozen"));
    expect(Object.isFrozen(registered)).toBe(true);
  });

  it("returns undefined for an unknown id", () => {
    expect(getFileLoader("registry-test-missing")).toBeUndefined();
    expect(getGameLoader("registry-test-missing")).toBeUndefined();
  });
});
