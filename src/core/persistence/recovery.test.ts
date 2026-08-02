// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  clearProgressFromLocalStorage,
  deserializeProgress,
  PROGRESS_STORAGE_KEY,
  serializeProgress,
} from "./serialize";

describe("recovery / persistence contracts", () => {
  it("opening a workspace path dismisses stale recovery offers", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    expect(store).toMatch(/dismissPendingRecovery/);
    expect(store).toMatch(/openWorkspaceFromText/);
    expect(store).toMatch(/pendingRecovery:\s*null/);
  });

  it("Continue cannot restore after recovery was dismissed", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    expect(store).toMatch(/const recovery = state\.pendingRecovery/);
    expect(store).toMatch(/if \(!recovery\) return/);
  });

  it("Start over discards the stored recovery session", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    expect(store).toMatch(/dismissPendingRecovery\(true\)/);
    expect(store).toMatch(/clearProgressFromLocalStorage/);
    expect(PROGRESS_STORAGE_KEY).toBe("necesse_lang_translator_v1");
    clearProgressFromLocalStorage();
  });

  it("serialize keeps neutral filename fallbacks", () => {
    const document = serializeProgress({
      filename: "",
      referenceFilename: "",
      eol: "\n",
      savedAt: 1,
      items: [],
      meta: {
        provider: "google",
        targetLanguage: "",
        spellcheck: true,
        autocompleteEnabled: true,
      },
    });
    const restored = deserializeProgress(document);
    expect(restored.filename).toBe("");
    expect(restored.meta.targetLanguage).toBe("");
  });
});
