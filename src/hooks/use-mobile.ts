// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Width at which the filter rail stops fitting beside the list and becomes a
 * drawer. Wider than shadcn's stock 768px on purpose: the rail is 236px and the
 * entry cards need the rest, so the switch has to happen earlier.
 */
const MOBILE_BREAKPOINT = 860;

/** Consumed by `Sidebar` to decide between the docked rail and the Sheet. */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
