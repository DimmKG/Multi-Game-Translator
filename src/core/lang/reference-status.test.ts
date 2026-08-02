// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { applyReferenceMap, parseLangFile, parseReferenceLang } from "@/core/lang/parse";
import { hasUsableReference, statusOf } from "@/core/lang/status";

describe("reference-dependent status", () => {
  it("SAME marker is only a UI same-status when a reference is matched", () => {
    const parsed = parseLangFile("SAME_TRANSLATION:hello=Hello\n");
    const entry = parsed.items[0];
    expect(entry.type).toBe("entry");
    if (entry.type !== "entry") return;
    expect(statusOf(entry)).toBe("done");
    applyReferenceMap(parsed.items, parseReferenceLang("hello=Hello\n"));
    expect(statusOf(entry)).toBe("same");
  });

  it("hasUsableReference requires filename and at least one matched entry", () => {
    const parsed = parseLangFile("hello=Hallo\n");
    expect(hasUsableReference(parsed.items, "en.lang")).toBe(false);
    applyReferenceMap(parsed.items, parseReferenceLang("hello=Hello\n"));
    expect(hasUsableReference(parsed.items, "")).toBe(false);
    expect(hasUsableReference(parsed.items, "en.lang")).toBe(true);
  });
});
