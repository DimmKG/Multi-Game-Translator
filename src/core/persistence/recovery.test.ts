// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { act, createElement, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { deleteDB } from "idb";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { TranslationDocument } from "@mgt/sdk";
import { iniFileLoader } from "@mgt/sdk";
import { necesseGameLoader } from "@mgt/mod-necesse";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { WorkspaceProvider, useWorkspace } from "@/state/workspace-store";
import { closeNecesseDb, DB_NAME, resetNecesseDbCache } from "./idb";
import { saveWorkspaceDocument, loadWorkspaceDocument } from "./document-store";

// Required by React's `act()` outside of a dedicated testing-library setup.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type WorkspaceContextValue = ReturnType<typeof useWorkspace>;

function buildDocument(text: string, targetLocale = "ru"): TranslationDocument {
  const raw = iniFileLoader.parse({ files: [{ name: "translation.lang", text }] });
  return necesseGameLoader.toDocument(raw, [{ role: "translation" }], targetLocale);
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

let container: HTMLDivElement;
let root: Root | null = null;

/** Mounts the real provider tree and returns a getter for the latest context value. */
async function mountWorkspace(): Promise<() => WorkspaceContextValue> {
  let latest!: WorkspaceContextValue;
  function Probe() {
    latest = useWorkspace();
    return null;
  }
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(
        I18nProvider,
        null,
        createElement(WorkspaceProvider, null, createElement(Probe)),
      ),
    );
  });
  return () => latest;
}

beforeEach(async () => {
  await closeNecesseDb();
  await deleteDB(DB_NAME);
  resetNecesseDbCache();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(async () => {
  if (root) {
    const current = root;
    await act(async () => {
      current.unmount();
    });
    root = null;
  }
  container.remove();
  await closeNecesseDb();
});

describe("recovery / persistence contracts", () => {
  it("restores a stored session immediately, without a confirmation step, resuming on its last active tab", async () => {
    await saveWorkspaceDocument({
      document: buildDocument("hello=Hallo\n"),
      uiFlags: {},
      filename: "seeded.lang",
      referenceFilename: "en.lang",
      view: "review",
      savedAt: 111,
      provider: "google",
      spellcheck: true,
      autocompleteEnabled: true,
    });

    const get = await mountWorkspace();
    await waitFor(() => get().ready);

    expect(get().isOpen).toBe(true);
    expect(get().filename).toBe("seeded.lang");
    expect(get().view).toBe("review");
    // No recovery banner / confirm-to-continue flow exists anymore.
    expect(container.textContent).not.toMatch(/restore session|recovery/i);
  });

  it("never clobbers a workspace already opened before hydrate resolves", async () => {
    await saveWorkspaceDocument({
      document: buildDocument("hello=Hallo\n"),
      uiFlags: {},
      filename: "stale-stored.lang",
      referenceFilename: "",
      view: "editor",
      savedAt: 1,
      provider: "google",
      spellcheck: true,
      autocompleteEnabled: true,
    });

    let latest!: WorkspaceContextValue;
    function OpenImmediately() {
      const value = useWorkspace();
      latest = value;
      const openedRef = useRef(false);
      // Fires on first mount, before hydrate's async IndexedDB read resolves —
      // simulates a workspace opened synchronously while hydrate is in flight.
      // A child's effects run before its parent's (WorkspaceProvider owns the
      // hydrate effect), so this genuinely races ahead of it. selectGameLoader's
      // state update is async (React batches it), so the open itself has to wait
      // one more render — same two-step shape the real game-select→dropzone flow has.
      useEffect(() => {
        if (!value.selectedGameLoaderId) {
          value.selectGameLoader("necesse");
          return;
        }
        if (openedRef.current) return;
        openedRef.current = true;
        value.openWorkspaceFromText("greeting=Hi\n", { filename: "fresh.lang" });
      });
      return null;
    }
    root = createRoot(container);
    await act(async () => {
      root!.render(
        createElement(
          I18nProvider,
          null,
          createElement(WorkspaceProvider, null, createElement(OpenImmediately)),
        ),
      );
    });

    await waitFor(() => latest.ready);

    expect(latest.isOpen).toBe(true);
    expect(latest.filename).toBe("fresh.lang");
  });

  it("page-hide flushes the debounced save immediately instead of waiting out the timer", async () => {
    const get = await mountWorkspace();
    await waitFor(() => get().ready);

    act(() => {
      get().selectGameLoader("necesse");
    });
    act(() => {
      get().openWorkspaceFromText("hello=Hallo\n", { filename: "flush.lang" });
    });
    await waitFor(() => get().isOpen);

    act(() => {
      get().updateEntryValue(get().entries[0].id, "Servus");
    });
    // The debounce is 500ms — dispatch pagehide well before it would fire on its own.
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await waitFor(async () => {
      const stored = await loadWorkspaceDocument();
      const node = stored?.document.nodes[0];
      return !!node && node.type === "entry" && node.entry.target === "Servus";
    });
  });

  // The overlapping-write re-entrancy guard (writeInFlight/rewriteRequested)
  // exists for a race that's impractical to trigger deterministically from a
  // black-box render — it depends on two IndexedDB writes genuinely
  // overlapping, and fake-indexeddb resolves fast enough that a real overlap
  // can't be forced without mocking the persistence layer out from under the
  // other tests in this file. Asserted structurally instead.
  it("a write in flight is not clobbered by an overlapping flush", async () => {
    const store = await readFile(path.join(process.cwd(), "src/state/workspace-store.tsx"), "utf8");
    const persistNow = /const persistNow = useCallback\([\s\S]*?\[persistOnce\],\n {2}\);/.exec(
      store,
    )?.[0];
    expect(persistNow).toBeTruthy();
    expect(persistNow).toMatch(
      /if \(writeInFlight\.current\) \{\s*rewriteRequested\.current = true;/,
    );
    expect(persistNow).toMatch(/while \(rewriteRequested\.current\)/);
  });
});
