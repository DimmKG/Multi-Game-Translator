// SPDX-License-Identifier: AGPL-3.0-or-later
import { iniFileLoader, type TranslationDocument } from "@mgt/sdk";
import { necesseGameLoader, necessePlaceholderTokenizer } from "@mgt/mod-necesse";
import { genericIniGameLoader } from "@mgt/mod-generic-ini";
import { describe, expect, it } from "vitest";

import type { WorkspaceUiFlags } from "@/core/persistence/idb";
import {
  buildEntryIndex,
  buildWorkspaceEntries,
  buildWorkspaceLines,
  buildWorkspaceRowIndex,
  exportedText,
  findWorkspaceEntry,
  hasUsableReference,
  placeholderIssues,
  reindexWorkspaceEntry,
  referenceDisplayText,
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
    expect(hello.supportsMarkedSame).toBe(true);

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

describe("buildWorkspaceLines", () => {
  it("interleaves sections with their entries, in document order", () => {
    const document = buildDocument("[greetings]\nhello=Hallo\n[farewells]\nbye=Tschuss\n");
    const lines = buildWorkspaceLines(document, new Map());
    expect(lines.map((line) => (line.type === "section" ? line.name : line.entry.key))).toEqual([
      "greetings",
      "hello",
      "farewells",
      "bye",
    ]);
  });
});

describe("findWorkspaceEntry", () => {
  it("finds an entry by id straight from the document", () => {
    const document = buildDocument("hello=Hallo\n");
    const [expected] = buildWorkspaceEntries(document, new Map());
    expect(findWorkspaceEntry(document, expected.id, new Map())).toEqual(expected);
    expect(findWorkspaceEntry(document, "missing-id", new Map())).toBeUndefined();
  });
});

describe("referenceDisplayText", () => {
  it("prefers the matched reference over the frozen original", () => {
    const document = buildDocument("MISSING_TRANSLATION:hello=Hallo\n", "hello=Hello\n");
    const [entry] = buildWorkspaceEntries(document, new Map());
    expect(referenceDisplayText(entry)).toBe("Hello");
  });

  it("falls back to the frozen original when missing but unmatched", () => {
    const document = buildDocument("MISSING_TRANSLATION:hello=Hallo\n");
    const [entry] = buildWorkspaceEntries(document, new Map());
    expect(referenceDisplayText(entry)).toBe("Hallo");
  });

  it("is null for an already-translated entry with no matched reference", () => {
    const document = buildDocument("hello=Hallo\n");
    const [entry] = buildWorkspaceEntries(document, new Map());
    expect(referenceDisplayText(entry)).toBeNull();
  });
});

describe("hasUsableReference", () => {
  it("requires both a reference filename and at least one matched entry", () => {
    const withMatch = buildWorkspaceEntries(
      buildDocument("MISSING_TRANSLATION:hello=Hallo\n", "hello=Hello\n"),
      new Map(),
    );
    const withoutMatch = buildWorkspaceEntries(
      buildDocument("MISSING_TRANSLATION:hello=Hallo\n"),
      new Map(),
    );
    expect(hasUsableReference(withMatch, "en.lang")).toBe(true);
    expect(hasUsableReference(withMatch, "")).toBe(false);
    expect(hasUsableReference(withoutMatch, "en.lang")).toBe(false);
  });
});

describe("placeholderIssues", () => {
  it("flags a missing required token (var)", () => {
    expect(placeholderIssues("Hello <name>", "Hallo", necessePlaceholderTokenizer)).toEqual({
      missingRequired: ["<name>"],
      missingFormattingKinds: [],
    });
  });

  it("returns nothing when every required token is present", () => {
    expect(placeholderIssues("Hello <name>", "Hallo <name>", necessePlaceholderTokenizer)).toEqual({
      missingRequired: [],
      missingFormattingKinds: [],
    });
  });

  it("is multiset-aware for required tokens: two occurrences need two matches", () => {
    expect(
      placeholderIssues("<a> and <a>", "<a>", necessePlaceholderTokenizer).missingRequired,
    ).toEqual(["<a>"]);
    expect(
      placeholderIssues("<a> and <a>", "<a> und <a>", necessePlaceholderTokenizer).missingRequired,
    ).toEqual([]);
  });

  it("does not flag a formatting kind that is merely reordered or reduced in count", () => {
    const issues = placeholderIssues(
      "[item/ref=sword] and [item/ref=shield]",
      "[item/ref=shield]",
      necessePlaceholderTokenizer,
    );
    expect(issues.missingFormattingKinds).toEqual([]);
  });

  it("flags a formatting kind only when it is entirely absent from target", () => {
    const issues = placeholderIssues(
      "Take the [item/ref=sword]",
      "Take it",
      necessePlaceholderTokenizer,
    );
    expect(issues.missingFormattingKinds).toEqual(["ref"]);
  });

  it("returns nothing when source has no protected tokens", () => {
    expect(placeholderIssues("Hello", "Hallo", necessePlaceholderTokenizer)).toEqual({
      missingRequired: [],
      missingFormattingKinds: [],
    });
  });
});

describe("row indexing", () => {
  it("buildWorkspaceRowIndex flags token/whitespace issues per entry", () => {
    const document = buildDocument(
      "MISSING_TRANSLATION:hello=Hallo\nbye=Tschuss \n",
      "hello=<name> Hello\nbye=Bye\n",
    );
    const entries = buildWorkspaceEntries(document, new Map());
    const index = buildWorkspaceRowIndex(entries, necesseGameLoader, []);

    const hello = entries.find((e) => e.key === "hello")!;
    expect(index.get(hello.id)?.tokenIssue).toBe(true);
    expect(index.get(hello.id)?.hasRef).toBe(true);

    const bye = entries.find((e) => e.key === "bye")!;
    expect(index.get(bye.id)?.wsIssue).toBe(true);
  });

  it("buildWorkspaceRowIndex checks every plural category, not just the flat fallback", () => {
    const document = buildDocument("hello=<name> Hallo\n", "hello=<name> Hello\n");
    const entries = buildWorkspaceEntries(document, new Map());
    const hello = entries.find((e) => e.key === "hello")!;

    const clean = { ...hello, targetPlurals: { one: "<name> Hallo", other: "<name> Hallo" } };
    expect(buildWorkspaceRowIndex([clean], necesseGameLoader, []).get(clean.id)?.tokenIssue).toBe(
      false,
    );

    // "other" (== the flat fallback) still has the token — only "one" lost it.
    const brokenOne = { ...hello, targetPlurals: { one: "Hallo", other: "<name> Hallo" } };
    expect(
      buildWorkspaceRowIndex([brokenOne], necesseGameLoader, []).get(brokenOne.id)?.tokenIssue,
    ).toBe(true);
  });

  it("reindexWorkspaceEntry updates only the targeted entry's row", () => {
    const document = buildDocument("MISSING_TRANSLATION:hello=Hallo\nbye=Tschuss\n");
    const entries = buildWorkspaceEntries(document, new Map());
    const index = buildWorkspaceRowIndex(entries, necesseGameLoader, []);

    const hello = entries.find((e) => e.key === "hello")!;
    const edited = { ...hello, target: "Hallo!", legacyStatus: "done" as const };
    const updated = reindexWorkspaceEntry(index, edited, necesseGameLoader, []);

    expect(updated.status).toBe("done");
    expect(index.get(hello.id)?.status).toBe("done");
    const bye = entries.find((e) => e.key === "bye")!;
    expect(index.get(bye.id)?.status).toBe("done");
  });
});

describe("cross-loader genericity (M6) — a document from a loader with no ext at all must not crash", () => {
  function buildGenericIniDocument(
    translationText: string,
    referenceText: string,
  ): TranslationDocument {
    const raw = iniFileLoader.parse({
      files: [
        { name: "t.ini", text: translationText },
        { name: "en.ini", text: referenceText },
      ],
    });
    return genericIniGameLoader.toDocument(
      raw,
      [{ role: "translation" }, { role: "reference" }],
      "de",
    );
  }

  it("buildWorkspaceEntries does not throw, and fills in loader-agnostic defaults", () => {
    const document = buildGenericIniDocument("hello=Hallo\nbye=\n", "hello=Hello\nbye=Bye\n");
    const entries = buildWorkspaceEntries(document, new Map());
    expect(entries).toHaveLength(2);

    const hello = entries.find((e) => e.key === "hello")!;
    expect(hello.referenceText).toBe("Hello");
    // No markedSame/wasMissing concept in this format — always the neutral default.
    expect(hello.markedSame).toBe(false);
    expect(hello.wasMissing).toBe(false);
    expect(hello.supportsMarkedSame).toBe(false);

    const bye = entries.find((e) => e.key === "bye")!;
    expect(bye.legacyStatus).toBe("missing");
  });

  it("toggleEntryMarkedSame is a no-op — the format has no such concept, regardless of a matched reference", () => {
    const document = buildGenericIniDocument("hello=Hallo\n", "hello=Hello\n");
    const [entry] = buildWorkspaceEntries(document, new Map());
    const next = toggleEntryMarkedSame(document, entry.id);
    expect(next).toBe(document);
  });

  it("updateEntryTarget and exportedText round-trip through the generic-ini loader", () => {
    const document = buildGenericIniDocument("hello=Hallo\n", "hello=Hello\n");
    const [entry] = buildWorkspaceEntries(document, new Map());
    const next = updateEntryTarget(document, entry.id, "Servus");
    expect(exportedText(next)).toBe("hello=Servus\n");
  });
});
