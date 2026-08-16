// SPDX-License-Identifier: AGPL-3.0-or-later
import { necesseLineDialect } from "@mgt/mod-necesse";
import { describe, expect, it } from "vitest";

import { compareEntryPair, diffRows, parseLine, summarizeRows } from "./token-aware-diff";

// Case 1 of the genericity demonstration (see token-aware-diff.test.ts for
// cases 2/3): the diff tool wired up with Necesse's *real* status-marker
// convention, via necesseLineDialect — the only file allowed to import both
// the host diff module and @mgt/mod-necesse.
describe("token-aware-diff with necesseLineDialect", () => {
  it("status prefixes are ignored for alignment but remain visible as changes", () => {
    const left = ["MISSING_TRANSLATION:greeting=Hello"];
    const right = ["greeting=Hello"];
    const rows = diffRows(left, right, necesseLineDialect);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("change");
    expect(rows[0].prefixOnly).toBe(true);
    expect(summarizeRows(rows, left, right, necesseLineDialect)).toEqual({
      added: 0,
      deleted: 0,
      changed: 1,
      prefixOnly: 1,
      changedKeys: 0,
      changedValues: 0,
    });
  });

  it("entry comparison reports key, value and status changes separately", () => {
    const detail = compareEntryPair(
      "MISSING_TRANSLATION:oldkey=Old value",
      "newkey=New value",
      necesseLineDialect,
    );
    expect(detail.type).toBe("entry");
    if (detail.type === "entry") {
      expect(detail.statusChanged).toBe(true);
      expect(detail.keyChanged).toBe(true);
      expect(detail.valueChanged).toBe(true);
    }
  });

  it("comments and section headers stay on the ordinary text path", () => {
    expect(parseLine("// comment", necesseLineDialect.parseEntryLine).type).toBe("text");
    expect(parseLine("[lang]", necesseLineDialect.parseEntryLine).type).toBe("text");
  });

  // Character-mode atomicity for protected tokens (§color, [item/ref=...],
  // literal \n) was deliberately dropped in the redesign to game-agnostic
  // punctuation-based tokenization — word mode already covers atomicity
  // (see token-aware-diff.test.ts's "partially changed placeholder" case),
  // and character mode's whole point is fine-grained, codepoint-level diffing.
});
