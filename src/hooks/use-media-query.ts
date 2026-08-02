// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from "react";

/** Subscribes to a media query so layout can branch in React, not just in CSS. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => typeof matchMedia === "function" && matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}
