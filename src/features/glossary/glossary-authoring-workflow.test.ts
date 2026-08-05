// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const authoringSource = await readFile(
  new URL("./GlossaryAuthoringWorkspace.tsx", import.meta.url),
  "utf8",
);
const managerSource = await readFile(new URL("./GlossaryDialog.tsx", import.meta.url), "utf8");
const terminologySource = await readFile(
  new URL("./TerminologyWorkspace.tsx", import.meta.url),
  "utf8",
);
const storeSource = await readFile(
  new URL("../../state/workspace-store.tsx", import.meta.url),
  "utf8",
);
const appSource = await readFile(new URL("../../App.tsx", import.meta.url), "utf8");

describe("glossary authoring workflow wiring", () => {
  it("keeps one recoverable authoring session in shared workspace state", () => {
    expect(storeSource).toContain(
      "const glossaryAuthoringSession = loadGlossaryAuthoringRecovery()",
    );
    expect(storeSource).toContain('view: glossaryAuthoringSession ? "terminology" : "editor"');
    expect(storeSource).toContain("saveGlossaryAuthoringRecovery(session)");
    expect(storeSource).toContain("saveGlossaryAuthoringSession(");
    expect(storeSource).toContain("exportGlossaryAuthoringSession(");
    expect(storeSource).toContain("isGlossaryAuthoringSessionDirty(session)");
  });

  it("opens Manager items in authoring even when no translation workspace is loaded", () => {
    expect(managerSource).toContain("openGlossaryAuthoring(glossary.id)");
    expect(managerSource).toContain("createGlossaryAuthoring()");
    expect(appSource).toContain('workspace.isOpen || workspace.view === "terminology"');
    expect(terminologySource).toContain('setSection("authoring")');
    expect(terminologySource).toContain("<GlossaryAuthoringWorkspace />");
  });

  it("exposes validation, filtering, and every glossary entry field", () => {
    expect(authoringSource).toContain("validateGlossaryAuthoringSession(session)");
    expect(authoringSource).toContain("validationFilter");
    for (const field of [
      "source",
      "target",
      "forms",
      "alternatives",
      "forbidden",
      "caseSensitive",
      "wholeWord",
      "status",
      "category",
      "context",
      "note",
    ]) {
      expect(authoringSource).toContain(field);
    }
    expect(authoringSource).toContain("authoringExportWarningsConfirm");
    expect(authoringSource).toContain("authoringDeleteEntryConfirm");
  });
});
