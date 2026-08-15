// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { fixWhitespace, scanWhitespace } from "./whitespace";

describe("scanWhitespace", () => {
  it("flags whitespace in target that reference does not have", () => {
    expect(scanWhitespace(" Hallo", "Hello").lead).toBe(true);
    expect(scanWhitespace("Hallo ", "Hello").trail).toBe(true);
    expect(scanWhitespace("Ha  llo", "Hello").dbl).toBe(true);
    expect(scanWhitespace("Ha\tllo", "Hello").tab).toBe(true);
    expect(scanWhitespace("Ha llo", "Hello").nbsp).toBe(true);
  });

  it("does not flag whitespace the reference already has", () => {
    expect(scanWhitespace(" Hallo", " Hello").lead).toBe(false);
    expect(scanWhitespace("Hallo ", "Hello ").trail).toBe(false);
  });

  it("flags lead/trail whitespace when there is no reference to compare against", () => {
    const anomalies = scanWhitespace(" Hallo ", null);
    expect(anomalies.lead).toBe(true);
    expect(anomalies.trail).toBe(true);
    expect(anomalies.any).toBe(true);
  });

  it("clean text with no reference reports no anomalies", () => {
    expect(scanWhitespace("Hallo", null).any).toBe(false);
  });
});

describe("fixWhitespace", () => {
  it("trims target lead/trail when the reference has none", () => {
    expect(fixWhitespace(" Hallo ", "Hello")).toBe("Hallo");
  });

  it("reapplies the reference's own lead/trail after fixing the target", () => {
    expect(fixWhitespace("Hallo", " Hello ")).toBe(" Hallo ");
  });

  it("normalizes tabs, nbsp, and double spaces to a single space", () => {
    expect(fixWhitespace("Ha\tllo", null)).toBe("Ha llo");
    expect(fixWhitespace("Ha  llo", null)).toBe("Ha llo");
    expect(fixWhitespace("Ha llo", null)).toBe("Ha llo");
  });
});
