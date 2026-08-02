/** Gap kept between a revealed card and the edge of the visible area. */
export const REVEAL_MARGIN = 8;

export interface RevealBox {
  top: number;
  bottom: number;
}

/**
 * How far to scroll a container so `box` is not hidden by the keyboard.
 *
 * Returns the delta to add to `scrollTop` — positive scrolls the content up.
 * Zero means the card is already comfortably in view, which matters: scrolling
 * on every keystroke would fight the caret.
 *
 * A card that is taller than the remaining space cannot fit whole, so its top
 * is aligned instead — the key and the source text are what you need while
 * typing, and the textarea grows downwards from there.
 */
export function revealDelta(view: RevealBox, box: RevealBox, margin = REVEAL_MARGIN): number {
  const viewTop = view.top + margin;
  const viewBottom = view.bottom - margin;
  if (viewBottom <= viewTop) return 0;

  const overshootTop = box.top - viewTop;
  const overshootBottom = box.bottom - viewBottom;

  if (box.bottom - box.top > viewBottom - viewTop) return overshootTop;
  if (overshootBottom > 0) return overshootBottom;
  if (overshootTop < 0) return overshootTop;
  return 0;
}
