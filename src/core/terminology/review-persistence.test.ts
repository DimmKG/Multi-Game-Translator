// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  buildTerminologyReviewSessionId,
  loadTerminologyReviewDecisions,
  loadTerminologyReviewState,
  saveTerminologyReviewDecisions,
  saveTerminologyReviewState,
} from "./review-persistence";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const source = {
  filename: "en.lang",
  languageCode: "en",
  text: "[items]\nironbar=Iron Bar\n",
};

const translation = {
  filename: "bg.lang",
  languageCode: "bg",
  text: "[items]\nironbar=Желязно кюлче\n",
};

describe("terminology review persistence", () => {
  it("creates stable corpus-specific session ids", () => {
    const first = buildTerminologyReviewSessionId(source, [translation], 2);
    const reordered = buildTerminologyReviewSessionId(source, [translation], 2);
    const changed = buildTerminologyReviewSessionId(
      source,
      [{ ...translation, text: `${translation.text}copperbar=Медно кюлче\n` }],
      2,
    );

    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("stores only explicit decisions and filters stale sources", () => {
    const storage = new MemoryStorage();
    const sessionId = buildTerminologyReviewSessionId(source, [translation], 2);

    expect(
      saveTerminologyReviewDecisions(
        sessionId,
        {
          "Iron Bar": "accepted",
          "Copper Bar": "needs-review",
          "Tin Bar": "pending",
        },
        storage,
      ),
    ).toBe(true);

    expect(
      loadTerminologyReviewDecisions(sessionId, new Set(["Iron Bar", "Tin Bar"]), storage),
    ).toEqual({ "Iron Bar": "accepted" });
  });

  it("stores compact preferred variants beside decisions", () => {
    const storage = new MemoryStorage();
    const sessionId = buildTerminologyReviewSessionId(source, [translation], 2);

    expect(
      saveTerminologyReviewState(
        sessionId,
        {
          decisions: { "Iron Bar": "accepted" },
          preferredVariants: {
            "Iron Bar": { bg: " Желязно кюлче ", de: "" },
            "Copper Bar": { bg: "Медно кюлче" },
          },
        },
        storage,
      ),
    ).toBe(true);

    expect(loadTerminologyReviewState(sessionId, new Set(["Iron Bar"]), storage)).toEqual({
      decisions: { "Iron Bar": "accepted" },
      preferredVariants: { "Iron Bar": { bg: "Желязно кюлче" } },
    });
  });

  it("recovers safely from invalid stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem("necesse-translator.terminology-review.v1", "not json");

    expect(loadTerminologyReviewState("missing", new Set(["Iron Bar"]), storage)).toEqual({
      decisions: {},
      preferredVariants: {},
    });
  });
});
