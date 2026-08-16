// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { GameLoader } from "../game-loader";
import { iniFileLoader, type IniFileLoaderRaw } from "../loaders/ini-file-loader";
import { createDraftFromReference } from "./create-from-reference";

/**
 * Minimal generic-ini-style stub: no status-prefix concept at all, unlike
 * Necesse. Used to show the successful default case (target === source reads
 * naturally as "translated", which is exactly what a fresh, unedited copy is
 * under a plain presence-based status rule).
 */
const stubGameLoader: GameLoader<IniFileLoaderRaw> = {
  id: "stub",
  displayName: "Stub",
  fileLoaderId: "ini",
  fileExtension: ".ini",
  requiredFiles: [],
  detectGame: () => 0,
  toDocument(raw, roles, targetLocale) {
    const translationIndex = roles.findIndex((role) => role.role === "translation");
    const referenceIndex = roles.findIndex((role) => role.role === "reference");
    const translation = raw[translationIndex];
    const reference = referenceIndex >= 0 ? raw[referenceIndex] : undefined;
    if (!translation) throw new Error("stub requires a translation file");

    const nodes = translation.ini.lines
      .filter((line) => line.type === "pair")
      .map((line, index) => {
        const referenceLine = reference?.ini.lines.filter((l) => l.type === "pair")[index];
        const source =
          referenceLine && referenceLine.type === "pair" ? referenceLine.value : line.value;
        return {
          type: "entry" as const,
          entry: {
            id: `stub:${line.key}:${index}`,
            key: line.key,
            source,
            target: line.value,
            status: line.value.trim() === "" ? ("missing" as const) : ("translated" as const),
            ext: {},
          },
        };
      });

    return {
      gameLoaderId: "stub",
      fileLoaderId: "ini",
      sourceLocale: "en",
      targetLocale,
      nodes,
      formatMeta: {},
      gameMeta: {},
    };
  },
  fromDocument: () => [],
  applyEntryPatch: (entry, patch) => ({ ...entry, target: patch.target ?? entry.target }),
  placeholders: { tokenize: () => [] },
  statusStrategy: {
    fromNative: (entry) => (entry.target.trim() === "" ? "missing" : "translated"),
    toNative: () => "none",
  },
  locale: {},
};

describe("createDraftFromReference", () => {
  it("duplicates the reference into a translation file with identical content", () => {
    const referenceRaw = iniFileLoader.parse({
      files: [{ name: "en.lang", text: "hello=Hello\n" }],
    });
    const doc = createDraftFromReference(iniFileLoader, stubGameLoader, referenceRaw, "ru");
    expect(doc.targetLocale).toBe("ru");
    expect(doc.nodes).toEqual([
      {
        type: "entry",
        entry: expect.objectContaining({ key: "hello", source: "Hello", target: "Hello" }),
      },
    ]);
  });

  it("without a native marker, a freshly-duplicated entry reads as translated, not missing", () => {
    // This is the documented caveat: the generic default can't inject a
    // format-specific "still untranslated" marker, so a plain presence-based
    // statusStrategy (like this stub's) sees non-empty text and reports
    // "translated" even though nothing has actually been translated yet.
    const referenceRaw = iniFileLoader.parse({
      files: [{ name: "en.lang", text: "hello=Hello\n" }],
    });
    const doc = createDraftFromReference(iniFileLoader, stubGameLoader, referenceRaw, "ru");
    const [node] = doc.nodes;
    expect(node && node.type === "entry" ? node.entry.status : undefined).toBe("translated");
  });

  it("throws when the reference serializes to no files", () => {
    const emptyRaw: IniFileLoaderRaw = [];
    expect(() => createDraftFromReference(iniFileLoader, stubGameLoader, emptyRaw, "ru")).toThrow(
      /requires a reference file/,
    );
  });

  it("supports custom roles for loaders that name them differently", () => {
    const referenceRaw = iniFileLoader.parse({ files: [{ name: "en.lang", text: "a=1\n" }] });
    const doc = createDraftFromReference(iniFileLoader, stubGameLoader, referenceRaw, "ru", [
      { role: "reference" },
      { role: "translation" },
    ]);
    expect(doc.nodes).toHaveLength(1);
  });
});
