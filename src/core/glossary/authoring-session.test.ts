// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  clearGlossaryAuthoringRecovery,
  createNewGlossaryAuthoringSession,
  exportGlossaryAuthoringSession,
  GLOSSARY_AUTHORING_RECOVERY_KEY,
  importGlossaryAuthoringSession,
  isGlossaryAuthoringSessionDirty,
  loadGlossaryAuthoringRecovery,
  openGlossaryAuthoringSession,
  saveGlossaryAuthoringRecovery,
  saveGlossaryAuthoringSession,
  updateGlossaryAuthoringSession,
  validateGlossaryAuthoringSession,
} from "./authoring-session";
import {
  loadGlossaryLibrary,
  saveGlossaryLibrary,
  upsertGlossaryLibrary,
} from "./library-persistence";
import { normalizeGlossary } from "./loader";

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

function validGlossary() {
  return normalizeGlossary({
    format: "necesse-glossary",
    version: 1,
    id: "necesse-bg",
    name: "Bulgarian glossary",
    sourceLanguage: "en",
    targetLanguage: "bg",
    game: "Necesse",
    authors: ["Translator"],
    updatedAt: "2026-08-04",
    entries: [
      {
        source: "Settler",
        target: "Заселник",
        status: "approved",
        category: "character",
      },
    ],
  });
}

describe("glossary authoring sessions", () => {
  it("keeps new and imported glossaries dirty until local save", () => {
    const fresh = createNewGlossaryAuthoringSession({ targetLanguage: "bg" });
    const imported = importGlossaryAuthoringSession(JSON.stringify(validGlossary()));

    expect(fresh.origin).toBe("new");
    expect(imported.origin).toBe("imported");
    expect(isGlossaryAuthoringSessionDirty(fresh)).toBe(true);
    expect(isGlossaryAuthoringSessionDirty(imported)).toBe(true);
  });

  it("tracks edits against a saved library baseline without mutating it", () => {
    const opened = openGlossaryAuthoringSession(validGlossary());
    const edited = updateGlossaryAuthoringSession(opened, (draft) => {
      draft.entries[0].target = "Колонист";
    });
    const reverted = updateGlossaryAuthoringSession(edited, (draft) => {
      draft.entries[0].target = "Заселник";
    });

    expect(opened.draft.entries[0].target).toBe("Заселник");
    expect(isGlossaryAuthoringSessionDirty(opened)).toBe(false);
    expect(isGlossaryAuthoringSessionDirty(edited)).toBe(true);
    expect(isGlossaryAuthoringSessionDirty(reverted)).toBe(false);
  });

  it("turns a validated draft into a clean local-library boundary", () => {
    let session = createNewGlossaryAuthoringSession({
      id: "necesse-bg",
      name: "Bulgarian glossary",
      targetLanguage: "bg",
      authors: ["Translator"],
      entries: [
        {
          source: "Settler",
          target: "Заселник",
          status: "approved",
          category: "character",
        },
      ],
    });
    session = saveGlossaryAuthoringSession(session, "2026-08-05").session;

    expect(session.origin).toBe("library");
    expect(session.draft.updatedAt).toBe("2026-08-05");
    expect(session.lastBoundaryDate).toBe("2026-08-05");
    expect(isGlossaryAuthoringSessionDirty(session)).toBe(false);
  });

  it("reloads a locally saved result through the shared glossary library", () => {
    const storage = new MemoryStorage();
    const imported = importGlossaryAuthoringSession(JSON.stringify(validGlossary()));
    const edited = updateGlossaryAuthoringSession(imported, (draft) => {
      draft.entries[0].target = "Колонист";
    });
    const saved = saveGlossaryAuthoringSession(edited, "2026-08-05");
    const library = upsertGlossaryLibrary([], saved.glossary);

    expect(saveGlossaryLibrary(library, storage)).toBe(true);
    const reloaded = openGlossaryAuthoringSession(loadGlossaryLibrary(storage)[0]);

    expect(reloaded.draft.entries[0].target).toBe("Колонист");
    expect(reloaded.draft.updatedAt).toBe("2026-08-05");
    expect(isGlossaryAuthoringSessionDirty(reloaded)).toBe(false);
  });

  it("exports without pretending unsaved edits were saved locally", () => {
    const opened = openGlossaryAuthoringSession(validGlossary());
    const edited = updateGlossaryAuthoringSession(opened, (draft) => {
      draft.entries[0].target = "Колонист";
    });
    const exported = exportGlossaryAuthoringSession(edited, "2026-08-06");

    expect(JSON.parse(exported.serialized).updatedAt).toBe("2026-08-06");
    expect(exported.session.lastBoundaryDate).toBe("2026-08-06");
    expect(isGlossaryAuthoringSessionDirty(exported.session)).toBe(true);
    expect(isGlossaryAuthoringSessionDirty(opened)).toBe(false);
  });

  it("blocks save and export while retaining validation warnings separately", () => {
    const incomplete = createNewGlossaryAuthoringSession({ targetLanguage: "bg" });
    const validation = validateGlossaryAuthoringSession(incomplete);

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(["invalid-id", "name-required"]),
    );
    expect(validation.warnings.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(["missing-authors", "empty-glossary"]),
    );
    expect(() => saveGlossaryAuthoringSession(incomplete, "2026-08-05")).toThrow();
    expect(() => exportGlossaryAuthoringSession(incomplete, "2026-08-05")).toThrow();
  });

  it("recovers incomplete drafts and ignores corrupted recovery data", () => {
    const storage = new MemoryStorage();
    const incomplete = createNewGlossaryAuthoringSession({
      targetLanguage: "bg",
      entries: [{ source: "Settler", target: "" }],
    });

    expect(saveGlossaryAuthoringRecovery(incomplete, storage)).toBe(true);
    expect(loadGlossaryAuthoringRecovery(storage)).toEqual(incomplete);

    storage.setItem(GLOSSARY_AUTHORING_RECOVERY_KEY, "not json");
    expect(loadGlossaryAuthoringRecovery(storage)).toBeNull();
    expect(clearGlossaryAuthoringRecovery(storage)).toBe(true);
    expect(storage.length).toBe(0);
  });
});
