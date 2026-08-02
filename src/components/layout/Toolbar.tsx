// SPDX-License-Identifier: AGPL-3.0-or-later
import { Search } from "lucide-react";
import type { ComponentProps } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

/**
 * The control bar each view puts above its list.
 *
 * Everything in it is h-8 — shadcn's default control height — so the row reads
 * as a row of peers. Below 860px it stays a single row and does not scroll:
 * BarOptions has already moved the secondary controls into a popover by then,
 * and a scrolling bar would carry that popover's own trigger off the edge.
 */
export function Toolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-card flex flex-none flex-wrap items-center gap-3 border-b px-4 py-2.5",
        "max-[860px]:flex-nowrap max-[860px]:gap-2 max-[860px]:px-2.5",
        className,
      )}
      {...props}
    />
  );
}

/** Search field with its magnifier. Wide enough to read, capped so it is not a lane. */
export function ToolbarSearch({
  className,
  ...props
}: Omit<ComponentProps<typeof InputGroupInput>, "type">) {
  return (
    <InputGroup className={cn("max-w-[560px] min-w-0 flex-1", className)}>
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput type="text" autoComplete="off" spellCheck={false} {...props} />
    </InputGroup>
  );
}

/** Keyboard hint. Stands down under 860px — the bar has no room to spare there. */
export function ToolbarHint({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-xs max-[860px]:hidden", className)}
      {...props}
    />
  );
}
