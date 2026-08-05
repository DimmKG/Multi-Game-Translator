// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { suggestLanguageCodeFromFilename } from "./language-code";

describe("suggestLanguageCodeFromFilename", () => {
  it("suggests common language tags from .lang filenames", () => {
    expect(suggestLanguageCodeFromFilename("bg.lang")).toBe("bg");
    expect(suggestLanguageCodeFromFilename("pt-br.lang")).toBe("pt-BR");
    expect(suggestLanguageCodeFromFilename("zh-hant.lang")).toBe("zh-Hant");
    expect(suggestLanguageCodeFromFilename("es-419.lang")).toBe("es-419");
  });

  it("does not guess from descriptive or unrelated filenames", () => {
    expect(suggestLanguageCodeFromFilename("bulgarian.lang")).toBe("");
    expect(suggestLanguageCodeFromFilename("translation-final.lang")).toBe("");
    expect(suggestLanguageCodeFromFilename("bg.txt")).toBe("");
  });
});
