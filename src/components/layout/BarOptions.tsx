import { SlidersHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useMediaQuery } from "@/hooks/use-media-query";
import { useI18n } from "@/features/i18n/I18nProvider";

/** Below this a control bar cannot hold its contents without scrolling sideways. */
const COMPACT_QUERY = "(max-width: 860px)";

/**
 * Secondary controls of a view's toolbar.
 *
 * Wide screens show them inline, as before. On a phone the same row would run
 * off the edge, so they drop down as a panel pinned under the bar — no overlay,
 * so the search field and the list stay visible and usable behind it.
 *
 * The panel is portalled and positioned from the bar's box rather than nested
 * inside it: the bar scrolls horizontally, and a child would be clipped by it.
 */
export function BarOptions({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const compact = useMediaQuery(COMPACT_QUERY);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const bar = triggerRef.current?.closest(".toolbar, .reviewbar, .diffbar");
    if (!bar) return;

    const place = () => {
      const rect = bar.getBoundingClientRect();
      setBox({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    place();

    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!compact) return <>{children}</>;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="qbtn bar-more"
        aria-label={t("menu.viewOptions")}
        title={t("menu.viewOptions")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
      </button>

      {open &&
        box &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("menu.viewOptions")}
            className="bar-options-panel"
            style={{ top: box.top, left: box.left, width: box.width }}
          >
            <div className="options-body">{children}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
