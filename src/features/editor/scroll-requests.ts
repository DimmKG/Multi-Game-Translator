// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Jump requests aimed at the editor list, raised from outside it (the section
 * rail, "edit" in review, Ctrl+Enter). The list is windowed, so the target row
 * is often not mounted and `scrollIntoView` on a DOM node would find nothing —
 * the list resolves the request to an index and drives its virtualizer instead.
 */
export type ScrollRequest = { type: "section"; name: string } | { type: "key"; key: string };

let pending: ScrollRequest | null = null;
const listeners = new Set<() => void>();

export function requestEditorScroll(request: ScrollRequest) {
  pending = request;
  for (const listener of listeners) listener();
}

export function takePendingScroll() {
  return pending;
}

export function clearPendingScroll() {
  pending = null;
}

export function subscribeToScrollRequests(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
