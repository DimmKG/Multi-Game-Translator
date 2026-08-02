import { describe, expect, it } from "vitest";

import {
  LANGUAGE_OPTIONS,
  codeFromFilename,
  normalizeProjectCode,
  suggestedFilename,
} from "./target-language";

describe("MT target language", () => {
  it("has an explicit unselected / empty state with no Russian default", () => {
    expect(normalizeProjectCode("")).toBe("");
    expect(normalizeProjectCode("ru")).toBe("ru");
    expect(suggestedFilename("")).toBe("");
  });

  it("recognized filenames and aliases are normalized safely", () => {
    expect(LANGUAGE_OPTIONS.some(([code]) => code === "bg")).toBe(true);
    expect(LANGUAGE_OPTIONS.some(([code]) => code === "pt-BR")).toBe(true);
    expect(LANGUAGE_OPTIONS.some(([code]) => code === "zh-TW")).toBe(true);
    expect(normalizeProjectCode("pr-br")).toBe("pt-BR");
    expect(codeFromFilename("bg.lang")).toBe("bg");
    expect(codeFromFilename("pt_BR.lang")).toBe("pt-BR");
  });

  it("unknown filenames do not commit a guessed target", () => {
    expect(codeFromFilename("translation.lang")).toBe("");
    expect(codeFromFilename("my-mod-pack.lang")).toBe("");
    expect(normalizeProjectCode("totally-unknown")).toBe("");
  });

  it("suggests a filename only for recognized codes", () => {
    expect(suggestedFilename("bg")).toBe("bg.lang");
    expect(suggestedFilename("pt-BR")).toBe("pt-BR.lang");
    expect(suggestedFilename("nope")).toBe("");
  });
});
