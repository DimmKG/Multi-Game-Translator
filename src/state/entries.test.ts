// SPDX-License-Identifier: AGPL-3.0-or-later
import { iniFileLoader, type TranslationDocument } from "@mgt/sdk";
import { necesseGameLoader } from "@mgt/mod-necesse";
import { describe, expect, it } from "vitest";

import type { WorkspaceUiFlags } from "@/core/persistence/idb";
import {
  buildEntryIndex,
  buildWorkspaceEntries,
  exportedText,
  toggleEntryMarkedSame,
  toLegacyStatus,
  updateEntryTarget,
} from "./entries";

function buildDocument(translationText: string, referenceText?: string): TranslationDocument {
  const files = [{ name: "translation.lang", text: translationText }];
  const roles = [{ role: "translation" }];
  if (referenceText !== undefined) {
    files.push({ name: "en.lang", text: referenceText });
    roles.push({ role: "reference" });
  }
  const raw = iniFileLoader.parse({ files });
  return necesseGameLoader.toDocument(raw, roles, "de");
}

describe("toLegacyStatus", () => {
  it("maps the SDK's 6-way status onto the app's 3-way vocabulary", () => {
    expect(toLegacyStatus("same")).toBe("same");
    expect(toLegacyStatus("missing")).toBe("missing");
    expect(toLegacyStatus("new")).toBe("missing");
    expect(toLegacyStatus("translated")).toBe("done");
    expect(toLegacyStatus("draft")).toBe("done");
    expect(toLegacyStatus("reviewed")).toBe("done");
  });
});

describe("buildWorkspaceEntries", () => {
  it("converts only entry nodes, carrying ext/uiFlags fields across", () => {
    const document = buildDocument(
      "[greetings]\nhello=Hallo\nMISSING_TRANSLATION:bye=Bye\n",
      "[greetings]\nhello=Hello\nbye=Bye\n",
    );
    const helloNode = document.nodes.find((n) => n.type === "entry" && n.entry.key === "hello");
    if (helloNode?.type !== "entry") throw new Error("fixture entry missing");
    const uiFlags = new Map<string, WorkspaceUiFlags>([
      [helloNode.entry.id, { touched: true, mtDraft: false }],
    ]);

    const entries = buildWorkspaceEntries(document, uiFlags);

    expect(entries).toHaveLength(2);
    const hello = entries.find((e) => e.key === "hello")!;
    expect(hello.namespace).toBe("greetings");
    expect(hello.target).toBe("Hallo");
    expect(hello.referenceText).toBe("Hello");
    expect(hello.touched).toBe(true);
    expect(hello.legacyStatus).toBe("done");

    const bye = entries.find((e) => e.key === "bye")!;
    expect(bye.wasMissing).toBe(true);
    expect(bye.touched).toBe(false);
    expect(bye.legacyStatus).toBe("missing");
  });
});

describe("buildEntryIndex", () => {
  it("indexes entries by their native id", () => {
    const document = buildDocument("hello=Hallo\n");
    const entries = buildWorkspaceEntries(document, new Map());
    const index = buildEntryIndex(entries);
    expect(index.size).toBe(entries.length);
    for (const entry of entries) expect(index.get(entry.id)).toBe(entry);
  });
});

describe("updateEntryTarget", () => {
  it("replaces only the targeted entry's text and recomputes its status", () => {
    const document = buildDocument("MISSING_TRANSLATION:hello=Hallo\nbye=Tschuss\n");
    const target = document.nodes.find((n) => n.type === "entry" && n.entry.key === "hello");
    if (target?.type !== "entry") throw new Error("fixture entry missing");

    const next = updateEntryTarget(document, target.entry.id, "Servus");

    const updated = next.nodes.find((n) => n.type === "entry" && n.entry.key === "hello");
    expect(updated?.type === "entry" && updated.entry.target).toBe("Servus");
    expect(updated?.type === "entry" && updated.entry.status).toBe("translated");
    // The other entry is untouched, same node reference.
    const untouchedIndex = document.nodes.findIndex(
      (n) => n.type === "entry" && n.entry.key === "bye",
    );
    expect(next.nodes[untouchedIndex]).toBe(document.nodes[untouchedIndex]);
  });
});

describe("toggleEntryMarkedSame", () => {
  it("flips markedSame and status when the entry has a matched reference", () => {
    const document = buildDocument("MISSING_TRANSLATION:hello=Hallo\n", "hello=Hello\n");
    const target = document.nodes.find((n) => n.type === "entry" && n.entry.key === "hello");
    if (target?.type !== "entry") throw new Error("fixture entry missing");

    const next = toggleEntryMarkedSame(document, target.entry.id);
    const updated = next.nodes.find((n) => n.type === "entry" && n.entry.key === "hello");
    expect(updated?.type === "entry" && updated.entry.status).toBe("same");
  });

  it("is a no-op (same document reference) when the entry has no matched reference", () => {
    const document = buildDocument("MISSING_TRANSLATION:hello=Hallo\n");
    const target = document.nodes.find((n) => n.type === "entry" && n.entry.key === "hello");
    if (target?.type !== "entry") throw new Error("fixture entry missing");

    const next = toggleEntryMarkedSame(document, target.entry.id);
    expect(next).toBe(document);
  });
});

describe("exportedText", () => {
  it("round-trips a document back to its native .lang text", () => {
    const document = buildDocument("hello=Hallo\n");
    expect(exportedText(document)).toBe("hello=Hallo\n");
  });
});
