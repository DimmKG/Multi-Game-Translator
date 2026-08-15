// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const dropzoneSource = await readFile(
  new URL("../../features/workspace/Dropzone.tsx", import.meta.url),
  "utf8",
);

describe("dropzone empty state (two required drop targets)", () => {
  it("shows the map icon tile and *.lang title", () => {
    expect(dropzoneSource).toContain("<FileType2");
    expect(dropzoneSource).toContain('data-testid="dropzone-icon"');
    expect(dropzoneSource).toContain("*.lang");
    expect(dropzoneSource).toContain('data-testid="dropzone-title"');
  });

  it("renders separate original and translation drop targets", () => {
    expect(dropzoneSource).toContain("data-testid={testId}");
    expect(dropzoneSource).toContain('testId="dropzone-original"');
    expect(dropzoneSource).toContain('inputId="originalFileInput"');
    expect(dropzoneSource).toContain("drop.originalLabel");
    expect(dropzoneSource).toContain("drop.originalHint");
    expect(dropzoneSource).toContain('testId="dropzone-translation"');
    expect(dropzoneSource).toContain('inputId="translationFileInput"');
    expect(dropzoneSource).toContain("drop.translationLabel");
    expect(dropzoneSource).toContain("drop.translationRequiresOriginalHint");
    expect(dropzoneSource).toContain('accept=".lang,.txt"');
  });

  it("keeps the Open action gated on both files and the new-translation entry point", () => {
    expect(dropzoneSource).toContain('id="btnOpenTranslation"');
    expect(dropzoneSource).toContain("drop.open");
    expect(dropzoneSource).toContain("canOpen");
    expect(dropzoneSource).toContain("data-new-translation-button");
    expect(dropzoneSource).toContain("btn.newTranslation");
    expect(dropzoneSource).toContain("canCreateNew");
  });

  it("renders the flat legend row with token swatches, as in the original", () => {
    expect(dropzoneSource).toContain('data-testid="dropzone-legend"');
    expect(dropzoneSource).toContain("legend.var");
    expect(dropzoneSource).toContain("[item/input=…]");
    expect(dropzoneSource).toContain("legend.fmt");
    expect(dropzoneSource).toContain("\\\\n");
    expect(dropzoneSource).toContain("var(--tok-var)");
    expect(dropzoneSource).toContain("var(--tok-ref)");
    expect(dropzoneSource).toContain("var(--tok-fmt)");
    expect(dropzoneSource).toContain("var(--tok-nl)");
  });

  it("uses shadcn Empty for the drop card chrome", () => {
    expect(dropzoneSource).toContain("Empty");
    expect(dropzoneSource).toContain("EmptyMedia");
    expect(dropzoneSource).toContain("EmptyTitle");
    expect(dropzoneSource).toContain('data-testid="dropzone"');
    expect(dropzoneSource).toContain("<Button");
  });
});
