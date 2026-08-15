// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { defaultIdentityStrategy } from "./identity";

describe("defaultIdentityStrategy", () => {
  it("produces distinct ids for repeated (namespace, key) pairs by occurrence index", () => {
    const strategy = defaultIdentityStrategy();
    const first = strategy.makeEntryId("Items", "sword.name", 0);
    const second = strategy.makeEntryId("Items", "sword.name", 1);
    expect(first).not.toBe(second);
  });

  it("treats a missing namespace as empty, not undefined", () => {
    const strategy = defaultIdentityStrategy();
    const withNamespace = strategy.makeEntryId("", "key", 0);
    const withoutNamespace = strategy.makeEntryId(undefined, "key", 0);
    expect(withNamespace).toBe(withoutNamespace);
  });

  it("does not define familyOf by default", () => {
    expect(defaultIdentityStrategy().familyOf).toBeUndefined();
  });
});
