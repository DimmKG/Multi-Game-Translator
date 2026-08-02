import { useEffect } from "react";

import { revealDelta } from "@/core/layout/keyboard-reveal";

/**
 * Below this the shrinking viewport is browser chrome — a collapsing URL bar —
 * rather than a keyboard, and the layout should not react to it.
 */
const MIN_KEYBOARD_HEIGHT = 120;

/**
 * Height left over that still fits the chrome and a whole card. Below it the
 * header has to go, or there is no room to see what you are typing.
 */
const COMFORTABLE_HEIGHT = 460;

/** Scrollers whose contents can end up under the keyboard. */
const SCROLLER_SELECTOR = ".list, .reviewlist, .difflist";
/** The block worth keeping whole, not just the focused field inside it. */
const CARD_SELECTOR = ".card, .rrow";

function editableTarget(node: unknown): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  if (node instanceof HTMLTextAreaElement) return node;
  if (node instanceof HTMLInputElement && node.type !== "checkbox" && node.type !== "radio") {
    return node;
  }
  return node.isContentEditable ? node : null;
}

function reveal(element: HTMLElement) {
  const scroller = element.closest<HTMLElement>(SCROLLER_SELECTOR);
  // Anything else — the search field, a dialog — sits in chrome that the
  // shrunken shell already keeps above the keyboard.
  if (!scroller) return;
  const card = element.closest<HTMLElement>(CARD_SELECTOR) ?? element;
  const delta = revealDelta(scroller.getBoundingClientRect(), card.getBoundingClientRect());
  if (delta) scroller.scrollTop += delta;
}

/**
 * Keeps the card you are typing in above the on-screen keyboard.
 *
 * Phones do not resize the page when the keyboard opens — they cover it, so a
 * shell sized to `100%` keeps laying out behind the keys and the card under the
 * caret disappears. The visual viewport reports the covered strip; we hand it to
 * CSS as `--keyboard-inset` so the shell shrinks to the space that is actually
 * visible, then scroll the focused card into what is left.
 *
 * Install once, at the top of the app.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let inset = 0;
    let revealFrame = 0;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;

    const revealFocused = () => {
      cancelAnimationFrame(revealFrame);
      // Two frames: the first applies the new shell height, the second measures
      // the card against the layout that height produced.
      revealFrame = requestAnimationFrame(() => {
        revealFrame = requestAnimationFrame(() => {
          const focused = editableTarget(document.activeElement);
          if (focused) reveal(focused);
        });
      });
    };

    const sync = () => {
      const editing = editableTarget(document.activeElement) != null;
      const covered = editing
        ? Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const next = covered > MIN_KEYBOARD_HEIGHT ? covered : 0;
      if (next === inset) return;
      inset = next;
      root.style.setProperty("--keyboard-inset", `${next}px`);
      root.classList.toggle("keyboard-open", next > 0);
      root.classList.toggle(
        "keyboard-cramped",
        next > 0 && window.innerHeight - next < COMFORTABLE_HEIGHT,
      );
      if (next > 0) revealFocused();
    };

    // Focus moving between cards leaves the inset unchanged, so the reveal has
    // to be driven by focus as well as by the viewport.
    const onFocusIn = (event: FocusEvent) => {
      clearTimeout(blurTimer);
      sync();
      if (inset > 0 && editableTarget(event.target)) revealFocused();
    };

    // Tapping from one card straight into the next blurs before it focuses.
    // Collapsing the inset in that gap would bounce the whole shell, so wait to
    // see whether the keyboard is really going away.
    const onFocusOut = () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(sync, 100);
    };

    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      cancelAnimationFrame(revealFrame);
      clearTimeout(blurTimer);
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      root.style.removeProperty("--keyboard-inset");
      root.classList.remove("keyboard-open", "keyboard-cramped");
    };
  }, []);
}
