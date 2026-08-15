// SPDX-License-Identifier: AGPL-3.0-or-later
import "fake-indexeddb/auto";

import type { TranslationDocument } from "@mgt/sdk";
import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearWorkspaceDocument,
  loadWorkspaceDocument,
  saveWorkspaceDocument,
} from "./document-store";
import { closeNecesseDb, DB_NAME, resetNecesseDbCache } from "./idb";

function sampleDocument(overrides: Partial<TranslationDocument> = {}): TranslationDocument {
  return {
    gameLoaderId: "necesse",
    fileLoaderId: "ini",
    sourceLocale: "en",
    targetLocale: "ru",
    nodes: [
      {
        type: "entry",
        entry: {
          id: "hello:0",
          key: "hello",
          source: "Hello",
          target: "Привет",
          status: "translated",
          ext: {},
        },
      },
    ],
    formatMeta: { eol: "\n", trailingNewline: true },
    gameMeta: {},
    ...overrides,
  };
}

beforeEach(async () => {
  await closeNecesseDb();
  await deleteDB(DB_NAME);
  resetNecesseDbCache();
});

afterEach(async () => {
  await closeNecesseDb();
});

describe("document-store", () => {
  it("returns null when nothing has been saved yet", async () => {
    expect(await loadWorkspaceDocument()).toBeNull();
  });

  it("round-trips a full workspace document record", async () => {
    const document = sampleDocument();
    await saveWorkspaceDocument({
      document,
      uiFlags: { "hello:0": { touched: true, mtDraft: false } },
      filename: "ru.lang",
      referenceFilename: "en.lang",
      view: "editor",
      savedAt: 1234,
      provider: "google",
      spellcheck: true,
      autocompleteEnabled: false,
    });

    const loaded = await loadWorkspaceDocument();
    expect(loaded).toEqual({
      document,
      uiFlags: { "hello:0": { touched: true, mtDraft: false } },
      filename: "ru.lang",
      referenceFilename: "en.lang",
      view: "editor",
      savedAt: 1234,
      provider: "google",
      spellcheck: true,
      autocompleteEnabled: false,
    });
  });

  it("overwrites the previous record on a second save (single-workspace app)", async () => {
    await saveWorkspaceDocument({
      document: sampleDocument(),
      uiFlags: {},
      filename: "first.lang",
      referenceFilename: "",
      view: "editor",
      savedAt: 1,
      provider: "google",
      spellcheck: true,
      autocompleteEnabled: true,
    });
    await saveWorkspaceDocument({
      document: sampleDocument({ targetLocale: "de" }),
      uiFlags: {},
      filename: "second.lang",
      referenceFilename: "",
      view: "editor",
      savedAt: 2,
      provider: "google",
      spellcheck: true,
      autocompleteEnabled: true,
    });

    const loaded = await loadWorkspaceDocument();
    expect(loaded?.filename).toBe("second.lang");
    expect(loaded?.document.targetLocale).toBe("de");
  });

  it("clears the stored record", async () => {
    await saveWorkspaceDocument({
      document: sampleDocument(),
      uiFlags: {},
      filename: "ru.lang",
      referenceFilename: "",
      view: "editor",
      savedAt: 1,
      provider: "google",
      spellcheck: true,
      autocompleteEnabled: true,
    });
    await clearWorkspaceDocument();
    expect(await loadWorkspaceDocument()).toBeNull();
  });
});
