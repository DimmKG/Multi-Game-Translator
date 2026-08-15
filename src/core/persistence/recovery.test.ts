// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { deserializeProgress, serializeProgress } from "./serialize";

describe("recovery / persistence contracts", () => {
  it("hydrate restores a stored session immediately, without a confirmation step", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    const app = await readFile(new URL("../../App.tsx", import.meta.url), "utf8");
    // No recovery banner / confirm-to-continue flow — a stored record is
    // applied as soon as hydrate finds one.
    expect(store).not.toMatch(/pendingRecovery/);
    expect(app).not.toMatch(/RecoveryBanner/);
    expect(store).toMatch(/if \(record\) applyStoredRecord\(record, glossaries\)/);
  });

  it("hydrate never clobbers a workspace already opened before it resolves", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    expect(store).toMatch(/if \(stateRef\.current\.isOpen\) \{/);
  });

  it("restoring a stored record resumes on its last active tab", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    const applyStoredRecord =
      /const applyStoredRecord = useCallback\([\s\S]*?\n {2}\);/.exec(store)?.[0] ?? "";
    expect(applyStoredRecord).toMatch(/view: record\.view/);
  });

  it("page-hide flushes the debounced save immediately instead of waiting out the timer", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    // M4 dropped the synchronous localStorage delta-mirror — the safety net is now just: cancel the pending debounce
    // and fire the (async) IndexedDB write immediately on unload/hide.
    const flush = /const flush = \(\) => \{[\s\S]*?\n {4}\};/.exec(store)?.[0] ?? "";
    expect(flush).toMatch(/clearTimeout\(saveTimer\.current\)/);
    expect(flush).toMatch(/void persistNow\(current\)/);
    expect(store).toMatch(/window\.addEventListener\("pagehide", flush\)/);
    expect(store).toMatch(/document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  });

  it("a write in flight is not clobbered by an overlapping flush", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    const persistNow = /const persistNow = useCallback\([\s\S]*?\[persistOnce\],\n {2}\);/.exec(
      store,
    )?.[0];
    expect(persistNow).toBeTruthy();
    // A flush that arrives while a write is already in flight doesn't start a
    // second overlapping write — it's queued and replayed once the first
    // write finishes, so no save is silently dropped.
    expect(persistNow).toMatch(
      /if \(writeInFlight\.current\) \{\s*rewriteRequested\.current = true;/,
    );
    expect(persistNow).toMatch(/while \(rewriteRequested\.current\)/);
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
