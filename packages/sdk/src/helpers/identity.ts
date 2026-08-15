// SPDX-License-Identifier: LGPL-3.0-or-later
import type { EntryIdentityStrategy } from "../game-loader";

const SEPARATOR = String.fromCharCode(0);

/**
 * namespace+key+occurrenceIndex — the same identity scheme as today's
 * referenceIdentity, generalized with a running occurrence count so that
 * duplicate (namespace, key) pairs stay distinct instead of colliding.
 */
export function defaultIdentityStrategy(): EntryIdentityStrategy {
  return {
    makeEntryId(namespace, key, occurrenceIndex) {
      return [namespace ?? "", key, occurrenceIndex].join(SEPARATOR);
    },
  };
}
