import { describe, expect, it } from "vitest";

import { revealDelta } from "@/core/layout/keyboard-reveal";

// The visible strip of the list once the keyboard covers the bottom.
const view = { top: 100, bottom: 400 };

describe("revealDelta", () => {
  it("leaves a card that is already in view alone", () => {
    expect(revealDelta(view, { top: 150, bottom: 300 })).toBe(0);
  });

  it("scrolls up by exactly the part hidden under the keyboard", () => {
    // 60px of the card sits below the visible area, 8px margin included.
    expect(revealDelta(view, { top: 300, bottom: 452 })).toBe(60);
  });

  it("scrolls down when the card is above the visible area", () => {
    expect(revealDelta(view, { top: 60, bottom: 200 })).toBe(-48);
  });

  it("aligns the top of a card too tall to fit whole", () => {
    expect(revealDelta(view, { top: 180, bottom: 900 })).toBe(72);
  });

  it("keeps the margin off both edges", () => {
    expect(revealDelta(view, { top: 105, bottom: 200 })).toBe(-3);
    expect(revealDelta(view, { top: 300, bottom: 395 })).toBe(3);
  });

  it("does nothing when the keyboard leaves no usable space", () => {
    expect(revealDelta({ top: 100, bottom: 110 }, { top: 300, bottom: 400 })).toBe(0);
  });
});
