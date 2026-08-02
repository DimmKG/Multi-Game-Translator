import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const dropzoneSource = await readFile(
  new URL("../../features/workspace/Dropzone.tsx", import.meta.url),
  "utf8",
);

describe("dropzone empty state (matches original card)", () => {
  it("shows the map icon tile and *.lang title", () => {
    expect(dropzoneSource).toContain("<FileType2");
    expect(dropzoneSource).toContain('data-testid="dropzone-icon"');
    expect(dropzoneSource).toContain("*.lang");
    expect(dropzoneSource).toContain('data-testid="dropzone-title"');
  });

  it("keeps the primary pick action and new-translation entry point", () => {
    expect(dropzoneSource).toContain('id="btnPick"');
    expect(dropzoneSource).toContain("drop.pick");
    expect(dropzoneSource).toContain("btn.newTranslation");
    expect(dropzoneSource).toContain('accept=".lang,.txt"');
  });

  it("renders the flat legend row with token swatches, as in the original", () => {
    expect(dropzoneSource).toContain('className="legend"');
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

  it("uses the original drop card chrome", () => {
    expect(dropzoneSource).toContain('className="empty"');
    expect(dropzoneSource).toContain('cn("drop", dragging && "over")');
    expect(dropzoneSource).toContain('className="lg"');
    expect(dropzoneSource).toContain('id="btnPick"');
    expect(dropzoneSource).toContain("<Button");
  });
});
