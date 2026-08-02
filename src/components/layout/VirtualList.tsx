import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The scroll container each view wraps its rows in.
 *
 * Deliberately without `scroll-behavior: smooth`: these lists are virtualised,
 * so a jump crosses thousands of unrendered rows. Animating it would scroll
 * through blank space and restart on every measurement pass.
 *
 * The tall bottom padding leaves room for the mobile keyboard.
 */
export const LIST_CLASS = cn(
  "min-h-0 flex-1 overflow-auto px-4 pt-3.5 pb-30",
  "max-[860px]:px-2.5 max-[860px]:pt-2.5",
);

/**
 * Windowed list for the workspace's long scrollers.
 *
 * A .lang file runs to thousands of entries, and rendering them all makes every
 * store update — a keystroke, a theme switch — walk the whole tree. This renders
 * only the visible slice; rows are measured after mount, so variable heights
 * (wrapped source text, resized textareas) settle to their real size.
 */
export interface VirtualListApi {
  /** Brings a row into view even when it is outside the rendered window. */
  scrollToIndex: (index: number, options?: { align?: "start" | "center" }) => void;
  /** The scroll container, for callers that need to calibrate against it. */
  getScrollElement: () => HTMLDivElement | null;
}

export function VirtualList<T>({
  items,
  estimateSize,
  overscan = 8,
  className,
  getKey,
  renderItem,
  header,
  empty,
  apiRef,
}: {
  items: readonly T[];
  apiRef?: { current: VirtualListApi | null };
  /**
   * Predicted height of a row, in px, before it is measured.
   *
   * Pass a per-row estimate rather than one constant: the scrollbar is sized
   * from these, so a flat guess makes the total jump around as real heights
   * arrive. The closer this is, the less the geometry moves — measurement stays
   * on as a self-healing safety net, but with good estimates it corrects nothing
   * visible.
   */
  estimateSize: (index: number) => number;
  overscan?: number;
  className?: string;
  getKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
  /** Rendered above the window, inside the scroll container (e.g. a sticky head). */
  header?: ReactNode;
  /** Rendered instead of the window when there are no items. */
  empty?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // estimateSize is not a dependency of tanstack's getMeasurements memo — a new
  // estimator alone leaves the cached total on the old guesses. Invalidate when
  // the identity changes (metrics landing, resize recalibration); keep it stable
  // between those so scrolling does not re-measure every frame.
  const prevEstimateRef = useRef(estimateSize);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
  });

  useLayoutEffect(() => {
    if (prevEstimateRef.current === estimateSize) return;
    prevEstimateRef.current = estimateSize;
    // Clears cached sizes back to estimates. Mounted rows do not remount, so
    // ResizeObserver will not re-fire — remeasure visible nodes in the same pass.
    virtualizer.measure();
    const root = scrollRef.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-index]")) {
      virtualizer.measureElement(el);
    }
  }, [estimateSize, virtualizer]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      scrollToIndex: (index, options) => {
        const align = options?.align ?? "center";
        // Heights are precomputed, so the first scroll already lands on the row.
        // One follow-up pass absorbs any sub-pixel correction from the rows that
        // just mounted; it stops as soon as the target is in the window.
        let attempts = 0;
        const settle = () => {
          virtualizer.scrollToIndex(index, { align });
          const arrived = virtualizer.getVirtualItems().some((item) => item.index === index);
          if (!arrived && ++attempts < 5) requestAnimationFrame(settle);
        };
        settle();
      },
      getScrollElement: () => scrollRef.current,
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={className} ref={scrollRef}>
      {header}
      {items.length === 0 ? (
        empty
      ) : (
        <div style={{ position: "relative", height: virtualizer.getTotalSize() }}>
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            return (
              <div
                key={getKey(item, virtualRow.index)}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  insetInlineStart: 0,
                  top: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  // Rows are independent boxes; scoping layout/style/paint work to
                  // each one keeps a mount from invalidating the whole list.
                  contain: "layout style paint",
                }}
              >
                {renderItem(item, virtualRow.index)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
