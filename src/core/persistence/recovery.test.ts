// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { deserializeProgress, serializeProgress } from "./serialize";

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
    expect(store).toMatch(/clearWorkspaceFromIdb/);
  });

  it("page-hide mirrors pending rows synchronously before the async IDB flush", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    // An IndexedDB transaction opened during unload may never commit, so the
    // localStorage mirror has to be written first — order matters here.
    const flush = /const flush = \(\) => \{[\s\S]*?\n {4}\};/.exec(store)?.[0] ?? "";
    expect(flush).toMatch(/writePendingMirror/);
    expect(flush.indexOf("writePendingMirror")).toBeLessThan(flush.indexOf("persistNow"));
    expect(store).toMatch(/window\.addEventListener\("pagehide", flush\)/);
    expect(store).toMatch(/document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  });

  it("a write in flight cannot clear rows it never saw", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    const persistOnce = /const persistOnce = useCallback\([\s\S]*?\n {2}\}, \[\]\);/.exec(
      store,
    )?.[0];
    expect(persistOnce).toBeTruthy();
    // The claim is taken before the first await, and only the claim is dropped.
    expect(persistOnce).toMatch(/for \(const id of claimedLines\) dirtyLineIds\.current\.delete/);
    expect(persistOnce).not.toMatch(/await[\s\S]*dirtyLineIds\.current\.clear\(\)/);
    // ...and put back when the write fails, so the next pass retries it.
    expect(persistOnce).toMatch(/catch \{[\s\S]*dirtyLineIds\.current\.add\(id\)/);
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
