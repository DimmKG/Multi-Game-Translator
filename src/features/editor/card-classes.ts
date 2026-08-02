// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from "@/lib/utils";

/**
 * The entry card's geometry, in one place.
 *
 * `card-metrics.ts` builds a hidden probe out of these same strings and measures
 * it to predict every row's height for the virtual list. If the card and the
 * probe drift apart the predictions go quietly wrong — the scrollbar starts
 * jumping and section jumps land short — so neither side gets its own copy.
 */

/**
 * Horizontal padding of the source block, one side, in px. Must match the
 * `px-[11px]` in ORIG_CLASS below — Tailwind scans source text, so the class
 * cannot be built from this constant, only kept honest against it.
 */
export const ORIG_INLINE_PADDING = 11;

export const CARD_CLASS = cn(
  "bg-card border-border-soft rounded-[10px] border px-3.5 py-3",
  "border-s-[3px] transition-[border-color] duration-150",
  "focus-within:bg-secondary focus-within:border-s-primary",
  "max-[860px]:px-[11px] max-[860px]:py-2.5",
);

/**
 * Gap under each card / section row. Must live *inside* the virtual row's
 * border box (padding), never as margin on the card — TanStack measures
 * getBoundingClientRect (no margins) and `contain: paint` clips overflowing
 * margins, so a `mb-*` gap collapses and the next row climbs onto the card.
 */
export const CARD_ROW_GAP_CLASS = "pb-2.5";
/** Keep in sync with `pb-2.5` above (10px). */
export const CARD_ROW_GAP = 10;

/** Status shows as the colour of the card's leading edge. */
export const CARD_STATUS_CLASS: Record<string, string> = {
  missing: "border-s-primary",
  done: "border-s-success",
  same: "border-s-same",
};

export const ROW1_CLASS = "mb-2 flex flex-wrap items-center gap-2.5";
export const ROW3_CLASS = "mt-2 flex flex-wrap items-center gap-2";

export const KEY_CLASS = cn(
  "bg-background cursor-pointer rounded-md border px-2.5 py-[3px]",
  "font-mono text-[12.5px] transition-colors",
  "hover:border-primary hover:text-primary",
);

/** Shape shared by every badge on a card; the colour pair comes from the caller. */
export const ENTRY_BADGE_CLASS = cn(
  "h-auto rounded-[5px] border-transparent px-[7px] py-0.5",
  "font-mono text-[10px] tracking-[0.1em] uppercase",
);

export const GUIDE_CLASS = cn(
  "mb-2 text-[12.5px] leading-[1.5] first-letter:text-primary",
  "text-[color-mix(in_oklab,var(--foreground)_85%,var(--background))]",
);

export const ORIG_CLASS = cn(
  "bg-background border-border-soft mb-2 rounded-[7px] border px-[11px] py-2",
  "text-[13.5px] leading-[1.55] break-words whitespace-pre-wrap",
);

export const OLABEL_CLASS = cn(
  "text-foreground-faint mb-1 block text-[10px] tracking-[0.14em] uppercase",
);

export const WARNLINE_CLASS = "text-warn mt-0.5 flex w-full items-center gap-1.5 text-xs";

/**
 * Overrides on the shadcn Textarea. `min-h-16` from the component is too tall
 * for a list of mostly one-line strings — 7472 of them.
 */
export const TEXTAREA_CLASS = cn(
  "min-h-[42px] resize-y rounded-[7px] px-[11px] py-[9px]",
  "text-sm leading-[1.55] break-words whitespace-pre-wrap [tab-size:4]",
);

/** The review view packs three columns into a row, so its textareas run smaller. */
export const REVIEW_TEXTAREA_CLASS = cn(
  "min-h-[38px] resize-y rounded-[7px] px-2.5 py-2",
  "text-[13.5px] leading-[1.55] break-words whitespace-pre-wrap [tab-size:4]",
);

/**
 * What the shadcn Textarea contributes to its own box height. The probe renders
 * a bare <textarea>, so it has to be told; a real one gets these from the
 * component. Keep in sync with `src/components/ui/textarea.tsx`.
 */
export const TEXTAREA_BASE_GEOMETRY = "field-sizing-content block w-full border";
