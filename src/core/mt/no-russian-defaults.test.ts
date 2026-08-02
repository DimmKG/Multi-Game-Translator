import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { codeFromFilename, normalizeProjectCode } from "@/core/mt/target-language";
import { deserializeProgress } from "@/core/persistence/serialize";

describe("no Russian restore / language defaults", () => {
  it("restoring progress never invents a Russian filename", () => {
    const restored = deserializeProgress({
      v: 2,
      f: "",
      e: 0,
      s: 1,
      n: "",
      m: { p: "google", t: "", s: 1, a: 1 },
      i: [],
    });
    expect(restored.filename).toBe("");
    expect(restored.meta.targetLanguage).toBe("");
  });

  it("machine translation and spellcheck have no implicit Russian target", async () => {
    const store = await readFile(
      new URL("../../state/workspace-store.tsx", import.meta.url),
      "utf8",
    );
    const providers = await readFile(new URL("../mt/providers.ts", import.meta.url), "utf8");
    expect(store).not.toMatch(/\|\|\s*"ru"/);
    expect(store).not.toMatch(/targetLang\s*\|\|\s*"ru"/);
    expect(providers).not.toMatch(/return\s+"ru"/);
  });

  it("unknown filenames do not invent a language code", () => {
    expect(normalizeProjectCode("")).toBe("");
    expect(normalizeProjectCode("unknown-locale")).toBe("");
    expect(codeFromFilename("notes.txt")).toBe("");
    expect(codeFromFilename("pt-BR.lang")).toBe("pt-BR");
    expect(codeFromFilename("bg (1).lang")).toBe("bg");
  });
});
