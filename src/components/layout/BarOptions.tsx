import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useI18n } from "@/features/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Below this a control bar cannot hold its contents without scrolling sideways. */
const COMPACT_QUERY = "(max-width: 860px)";

/**
 * Secondary controls of a view's toolbar.
 *
 * Wide screens show them inline, as before. On a phone the same row would run
 * off the edge, so they drop into a popover instead.
 *
 * Radix portals the panel and anchors it with floating-ui, which is what the
 * hand-rolled version was doing with getBoundingClientRect — the bars scroll
 * horizontally and would clip a nested child. `modal` stays off so the search
 * field and the list behind the panel keep working.
 */
export function BarOptions({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const compact = useMediaQuery(COMPACT_QUERY);

  if (!compact) return <>{children}</>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Always the trailing control of its bar, whatever precedes it. */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="ms-auto flex-none"
          aria-label={t("menu.viewOptions")}
          title={t("menu.viewOptions")}
        >
          <SlidersHorizontal aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        aria-label={t("menu.viewOptions")}
        className={cn(
          // Full bleed on a phone, the way the panel it replaces used to hang
          // under the bar; capped so it does not sprawl at the 860px edge.
          "w-[calc(100vw-1rem)] max-w-[28rem] items-stretch",
          // Stacked, these read as menu rows rather than centred pills.
          "[&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-start",
          "[&_[data-slot=toggle-group-item]]:flex-1 [&_[data-slot=toggle-group]]:w-full",
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
