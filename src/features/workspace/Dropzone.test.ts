// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const dropzoneSource = await readFile(
  new URL("../../features/workspace/Dropzone.tsx", import.meta.url),
  "utf8",
);

describe("dropzone (generic, N required drop targets driven by the active loader)", () => {
  it("shows the map icon tile and the active loader's display name as the title", () => {
    expect(dropzoneSource).toContain("<FileType2");
    expect(dropzoneSource).toContain('data-testid="dropzone-icon"');
    expect(dropzoneSource).toContain("{selectedLoader.displayName}");
    expect(dropzoneSource).toContain('data-testid="dropzone-title"');
  });

  it("iterates requiredFiles instead of hardcoding two fixed slots", () => {
    expect(dropzoneSource).toContain("selectedLoader.requiredFiles.map((rf) =>");
    expect(dropzoneSource).toContain("testId={`dropzone-${rf.role}`}");
    expect(dropzoneSource).toContain("t(rf.labelKey)");
    expect(dropzoneSource).toContain("accept={rf.accept}");
    expect(dropzoneSource).not.toContain('accept=".lang,.txt"');
    expect(dropzoneSource).not.toContain('inputId="originalFileInput"');
  });

  it("keeps the Open action gated on every required slot, and the new-translation entry point", () => {
    expect(dropzoneSource).toContain('id="btnOpenTranslation"');
    expect(dropzoneSource).toContain("drop.open");
    expect(dropzoneSource).toContain("canOpen");
    expect(dropzoneSource).toContain("openWorkspaceFiles");
    expect(dropzoneSource).toContain("data-new-translation-button");
    expect(dropzoneSource).toContain("btn.newTranslation");
    expect(dropzoneSource).toContain("canCreateNew");
  });

  it("hides the new-translation entry point when the active loader has no createFromReference", () => {
    expect(dropzoneSource).toContain("selectedLoader.createFromReference != null &&");
  });

  it("uses shadcn Empty for the drop card chrome", () => {
    expect(dropzoneSource).toContain("Empty");
    expect(dropzoneSource).toContain("EmptyMedia");
    expect(dropzoneSource).toContain("EmptyTitle");
    expect(dropzoneSource).toContain('data-testid="dropzone"');
    expect(dropzoneSource).toContain("<Button");
  });
});
