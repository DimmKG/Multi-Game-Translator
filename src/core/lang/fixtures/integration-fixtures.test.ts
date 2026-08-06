// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { diffRows, summarizeRows } from "@/core/compare/token-aware-diff";
import { buildLangFile } from "@/core/lang/export";
import {
  buildSyntheticEnglishReference,
  buildSyntheticTargetTranslation,
  countSyntheticEntries,
} from "@/core/lang/fixtures/synthetic-lang";
import {
  applyReferenceMap,
  createTranslationFromReference,
  parseLangFile,
  parseReferenceLang,
  referenceIdentity,
} from "@/core/lang/parse";
import { countProgress, statusOf, type TranslationEntry } from "@/core/lang/status";

describe("synthetic .lang integration fixtures", () => {
  const english = buildSyntheticEnglishReference();
  const target = buildSyntheticTargetTranslation();
  const expectedEntries = countSyntheticEntries();

  it("parses the generated English reference with metadata and entries", () => {
    const parsed = parseLangFile(english);
    const entries = parsed.items.filter((item): item is TranslationEntry => item.type === "entry");
    expect(entries.length).toBe(expectedEntries);
    expect(entries.some((entry) => entry.key === "localname" && entry.value === "English")).toBe(
      true,
    );
    expect(entries.some((entry) => entry.key === "watertile" && entry.value === "Water")).toBe(
      true,
    );
    expect(
      entries.some((entry) => entry.key === "greeting" && entry.value.includes("<name>")),
    ).toBe(true);
  });

  it("applies English reference onto the target despite divergent comments", () => {
    // Fixtures intentionally place different comment lines in en vs target so
    // line indexes diverge; matching must stay on section+key.
    expect(english).toContain("Reference-only notes");
    expect(target).toContain("Translator notes differ");
    expect(english).not.toContain("Translator notes differ");
    expect(target).not.toContain("Reference-only notes");

    const workspace = parseLangFile(target);
    const reference = parseReferenceLang(english);
    const matched = applyReferenceMap(workspace.items, reference);
    expect(matched).toBe(expectedEntries);

    const entries = workspace.items.filter(
      (item): item is TranslationEntry => item.type === "entry",
    );
    const missingCount = entries.filter((entry) => statusOf(entry) === "missing").length;
    const sameCount = entries.filter((entry) => statusOf(entry) === "same").length;
    expect(missingCount).toBeGreaterThan(0);
    expect(sameCount).toBeGreaterThan(0);

    const water = entries.find((entry) => entry.key === "watertile");
    expect(water).toMatchObject({ value: "Wasser", ref: "Water", section: "[tile]" });

    const exported = buildLangFile(workspace.items, workspace.eol);
    expect(exported).toContain("SAME_TRANSLATION:sandtile=");
    expect(exported).toContain("MISSING_TRANSLATION:");
    expect(countProgress(workspace.items).total).toBe(entries.length);
  });

  it("keeps duplicate title keys distinct across item and npc sections", () => {
    const workspace = parseLangFile(target);
    const reference = parseReferenceLang(english);
    applyReferenceMap(workspace.items, reference);

    expect(reference.bySectionKey.get(referenceIdentity("[item]", "title"))).toEqual([
      "Item Title",
    ]);
    expect(reference.bySectionKey.get(referenceIdentity("[npc]", "title"))).toEqual(["Npc Title"]);

    const entries = workspace.items.filter(
      (item): item is TranslationEntry => item.type === "entry" && item.key === "title",
    );
    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.section === "[item]")).toMatchObject({
      value: "Gegenstandstitel",
      ref: "Item Title",
    });
    expect(entries.find((entry) => entry.section === "[npc]")).toMatchObject({
      value: "NSC-Titel",
      ref: "Npc Title",
    });
  });

  it("creates a new translation workspace from English without inventing Russian defaults", () => {
    const created = createTranslationFromReference(english, "en.lang");
    expect(created.entryCount).toBe(expectedEntries);
    expect(created.referenceFilename).toBe("en.lang");
    expect(created.text.startsWith("//")).toBe(true);
    expect(created.text).toContain("MISSING_TRANSLATION:localname=English");
    expect(created.text).not.toContain("ru.lang");
  });

  it("compares the target against a regenerated missing-translation snapshot", () => {
    const created = createTranslationFromReference(target, "synthetic.lang");
    const left = target.split(/\r\n|\n/);
    const right = created.text.split(/\r\n|\n/);
    const rows = diffRows(left, right);
    const summary = summarizeRows(rows, left, right);
    expect(summary.changed + summary.prefixOnly).toBeGreaterThan(0);
  });
});
