import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { createTranslationFromReference } from "@/core/lang/parse";

const source = [
  "// header",
  "[general]",
  "hello=Hello <name>",
  "SAME_TRANSLATION:unchanged=Keep [item/input=stone]",
  "MISSING_TRANSLATION:old=Old\r\nline",
  "",
  "// footer",
].join("\r\n");

describe("new translation from reference", () => {
  it("preserves structure while marking every entry missing", () => {
    const result = createTranslationFromReference(source, "en.lang");
    expect(result.referenceFilename).toBe("en.lang");
    expect(result.entryCount).toBe(3);
    expect(result.text).toBe(
      [
        "// header",
        "[general]",
        "MISSING_TRANSLATION:hello=Hello <name>",
        "MISSING_TRANSLATION:unchanged=Keep [item/input=stone]",
        "MISSING_TRANSLATION:old=Old\r\nline",
        "",
        "// footer",
      ].join("\r\n"),
    );
  });

  it("reports an empty reference without inventing entries", () => {
    const result = createTranslationFromReference("// comments only\n[section]", "empty.lang");
    expect(result.entryCount).toBe(0);
    expect(result.text).toBe("// comments only\n[section]");
  });

  it("export path still requires an explicit target filename", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    expect(store).toMatch(/err\.targetFilenameRequired/);
    expect(store).toMatch(/if \(!name\)/);
  });

  it("UI wires new translation through the shared workspace API", async () => {
    const dropzone = await readFile(
      new URL("../../features/workspace/Dropzone.tsx", import.meta.url),
      "utf8",
    );
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    expect(store).toMatch(/createFromReferenceFile/);
    expect(dropzone).toMatch(/createFromReferenceFile/);
    expect(dropzone).not.toMatch(/new File\(\[result\.text\]/);
  });
});
