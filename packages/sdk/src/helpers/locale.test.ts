// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { detectIsoLocaleFromFilename } from "./locale";

describe("detectIsoLocaleFromFilename", () => {
  it("recognizes a bare language code", () => {
    expect(detectIsoLocaleFromFilename("ru.lang")).toBe("ru");
  });

  it("recognizes a region-qualified code with underscore separator", () => {
    expect(detectIsoLocaleFromFilename("de_DE.po")).toBe("de-DE");
  });

  it("recognizes a region-qualified code with hyphen separator", () => {
    expect(detectIsoLocaleFromFilename("pt-BR.ini")).toBe("pt-BR");
  });

  it("finds a locale segment among unrelated surrounding text", () => {
    expect(detectIsoLocaleFromFilename("translation.ru.lang")).toBe("ru");
  });

  it("is case-insensitive", () => {
    expect(detectIsoLocaleFromFilename("RU.lang")).toBe("ru");
  });

  it("strips a directory path before matching", () => {
    expect(detectIsoLocaleFromFilename("mods/necesse/ru.lang")).toBe("ru");
  });

  it("returns undefined for a filename with no recognizable locale", () => {
    expect(detectIsoLocaleFromFilename("translation.lang")).toBeUndefined();
  });

  it("returns undefined for a well-formed but unassigned language subtag", () => {
    expect(detectIsoLocaleFromFilename("xx.lang")).toBeUndefined();
  });

  it("returns undefined for an empty filename", () => {
    expect(detectIsoLocaleFromFilename("")).toBeUndefined();
  });
});
