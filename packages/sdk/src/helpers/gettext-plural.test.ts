// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  bridgeCldrToGettext,
  bridgeGettextToCldr,
  ENGLISH_PLURAL_FORMS,
  parsePluralForms,
} from "./gettext-plural";

const ENGLISH = "nplurals=2; plural=(n != 1);";
const FRENCH = "nplurals=2; plural=(n > 1);";
const RUSSIAN =
  "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);";
const JAPANESE = "nplurals=1; plural=0;";
const POLISH =
  "nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);";
const ARABIC =
  "nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);";

describe("parsePluralForms", () => {
  it("parses nplurals and the plural expression", () => {
    const { spec, fallbackReason } = parsePluralForms(ENGLISH);
    expect(fallbackReason).toBeUndefined();
    expect(spec.nplurals).toBe(2);
    expect(spec.evaluate(0)).toBe(1);
    expect(spec.evaluate(1)).toBe(0);
    expect(spec.evaluate(2)).toBe(1);
  });

  it("French treats n=0 as singular, unlike English", () => {
    const { spec } = parsePluralForms(FRENCH);
    expect(spec.evaluate(0)).toBe(0);
    expect(spec.evaluate(1)).toBe(0);
    expect(spec.evaluate(2)).toBe(1);
  });

  it("Japanese always selects index 0", () => {
    const { spec } = parsePluralForms(JAPANESE);
    expect(spec.nplurals).toBe(1);
    for (const n of [0, 1, 2, 11, 100]) expect(spec.evaluate(n)).toBe(0);
  });

  it("Russian's ternary/modulo/parens expression evaluates correctly", () => {
    const { spec } = parsePluralForms(RUSSIAN);
    expect(spec.nplurals).toBe(3);
    expect(spec.evaluate(1)).toBe(0);
    expect(spec.evaluate(21)).toBe(0);
    expect(spec.evaluate(11)).toBe(2); // exception: not "one" despite ending in 1
    expect(spec.evaluate(2)).toBe(1);
    expect(spec.evaluate(24)).toBe(1);
    expect(spec.evaluate(12)).toBe(2); // exception: not "few" despite ending in 2-4
    expect(spec.evaluate(0)).toBe(2);
    expect(spec.evaluate(5)).toBe(2);
  });

  it("Arabic's 6-way expression evaluates correctly", () => {
    const { spec } = parsePluralForms(ARABIC);
    expect(spec.nplurals).toBe(6);
    expect(spec.evaluate(0)).toBe(0);
    expect(spec.evaluate(1)).toBe(1);
    expect(spec.evaluate(2)).toBe(2);
    expect(spec.evaluate(3)).toBe(3);
    expect(spec.evaluate(11)).toBe(4);
    expect(spec.evaluate(100)).toBe(5);
  });

  it.each([
    ["missing header", undefined],
    ["empty string", ""],
    ["missing semicolons", "nplurals=2 plural=(n!=1)"],
    ["nplurals out of range", "nplurals=0; plural=(n!=1);"],
    ["oversized expression", `nplurals=2; plural=${"(n!=1)".repeat(500)};`],
  ])("falls back to English on %s, never throws", (_label, header) => {
    const { spec, fallbackReason } = parsePluralForms(header);
    expect(fallbackReason).toBeDefined();
    expect(spec).toBe(ENGLISH_PLURAL_FORMS);
  });

  it.each([
    ["JS constructor-access injection", "nplurals=2; plural=(n.constructor);"],
    ["multi-char identifier", "nplurals=2; plural=(nplurals);"],
    ["unbalanced parens", "nplurals=2; plural=((n!=1);"],
    ["trailing garbage inside the expression", "nplurals=2; plural=(n!=1) alert(1);"],
  ])("rejects hostile input (%s) as a plain parse failure, never executes it", (_label, header) => {
    const { spec, fallbackReason } = parsePluralForms(header);
    expect(spec).toBe(ENGLISH_PLURAL_FORMS);
    expect(fallbackReason).toBeDefined();
  });

  it("ignores anything after the field's own terminating semicolon — never part of the evaluated expression", () => {
    const { spec, fallbackReason } = parsePluralForms("nplurals=2; plural=(n != 1); alert(1)");
    expect(fallbackReason).toBeUndefined();
    expect(spec.evaluate(0)).toBe(1);
    expect(spec.evaluate(1)).toBe(0);
  });

  it("guards against runaway nesting depth", () => {
    const deeplyNested = `nplurals=2; plural=${"(".repeat(200)}n${")".repeat(200)};`;
    const { spec, fallbackReason } = parsePluralForms(deeplyNested);
    expect(spec).toBe(ENGLISH_PLURAL_FORMS);
    expect(fallbackReason).toBeDefined();
  });
});

describe("bridgeGettextToCldr / bridgeCldrToGettext", () => {
  it("bridges Russian's 3 gettext indices to CLDR one/few/many", () => {
    const { spec } = parsePluralForms(RUSSIAN);
    const map = bridgeGettextToCldr(spec, "ru");
    expect(map).toEqual({ 0: "one", 1: "few", 2: "many" });
    expect(bridgeCldrToGettext(map)).toEqual({ one: 0, few: 1, many: 2 });
  });

  it("bridges Arabic's 6 gettext indices to all 6 CLDR categories in order", () => {
    const { spec } = parsePluralForms(ARABIC);
    const map = bridgeGettextToCldr(spec, "ar");
    expect(map).toEqual({ 0: "zero", 1: "one", 2: "two", 3: "few", 4: "many", 5: "other" });
  });

  it("bridges Polish's 3 gettext indices to CLDR one/few/many", () => {
    const { spec } = parsePluralForms(POLISH);
    const map = bridgeGettextToCldr(spec, "pl");
    expect(map).toEqual({ 0: "one", 1: "few", 2: "many" });
  });

  it("bridges Japanese's single index to CLDR other", () => {
    const { spec } = parsePluralForms(JAPANESE);
    expect(bridgeGettextToCldr(spec, "ja")).toEqual({ 0: "other" });
  });

  it("bridges English's 2 indices to CLDR one/other", () => {
    const { spec } = parsePluralForms(ENGLISH);
    expect(bridgeGettextToCldr(spec, "en")).toEqual({ 0: "one", 1: "other" });
  });
});
