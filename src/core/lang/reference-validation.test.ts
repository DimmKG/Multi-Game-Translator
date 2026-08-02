import { describe, expect, it } from "vitest";

import {
  hasEnglishEngname,
  normalizeEnglishReferenceFilename,
  validateEnglishReferenceFile,
} from "@/core/lang/reference-validation";

describe("English reference validation", () => {
  it("accepts en.lang and cleaned download duplicates", () => {
    expect(normalizeEnglishReferenceFilename("en.lang")).toBe("en.lang");
    expect(normalizeEnglishReferenceFilename("EN.lang")).toBe("en.lang");
    expect(normalizeEnglishReferenceFilename("en (1).lang")).toBe("en.lang");
    expect(normalizeEnglishReferenceFilename("ru.lang")).toBeNull();
    expect(normalizeEnglishReferenceFilename("english.lang")).toBeNull();
  });

  it("requires engname=English in the file body", () => {
    expect(hasEnglishEngname("engname=English\nhello=Hello\n")).toBe(true);
    expect(hasEnglishEngname("engname=Synthetic\nhello=Hello\n")).toBe(false);
    expect(hasEnglishEngname("hello=Hello\n")).toBe(false);
    expect(hasEnglishEngname("SAME_TRANSLATION:engname=English\n")).toBe(true);
  });

  it("validateEnglishReferenceFile combines both checks", () => {
    const good = validateEnglishReferenceFile(
      "en.lang",
      "[lang]\nengname=English\nhello=Hello\n",
    );
    expect(good).toEqual({ ok: true, filename: "en.lang" });

    expect(validateEnglishReferenceFile("ru.lang", "engname=English\n").ok).toBe(false);
    expect(validateEnglishReferenceFile("en.lang", "engname=German\n").ok).toBe(false);
  });
});
