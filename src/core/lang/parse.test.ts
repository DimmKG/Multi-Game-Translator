// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { buildLangFile } from "./export";
import {
  applyReferenceMap,
  createTranslationFromReference,
  parseLangFile,
  parseReferenceLang,
} from "./parse";
import { statusOf } from "./status";

describe("parseLangFile", () => {
  it("preserves sections, markers and CRLF", () => {
    const source = "[misc]\r\nMISSING_TRANSLATION:hello=Hello\r\nSAME_TRANSLATION:bye=Bye\r\n";
    const parsed = parseLangFile(source);
    expect(parsed.eol).toBe("\r\n");
    expect(parsed.items[0]).toMatchObject({ type: "section", name: "[misc]" });
    const missing = parsed.items[1];
    const same = parsed.items[2];
    expect(missing).toMatchObject({
      type: "entry",
      key: "hello",
      wasMissing: true,
      value: "Hello",
    });
    expect(same).toMatchObject({ type: "entry", key: "bye", markedSame: true });
    if (missing.type === "entry") expect(statusOf(missing)).toBe("missing");
  });
});

describe("reference and export", () => {
  it("applies reference map and exports markers", () => {
    const parsed = parseLangFile("hello=Hallo\nbye=Bye\n");
    const reference = parseReferenceLang("hello=Hello\nbye=Bye\n");
    const matched = applyReferenceMap(parsed.items, reference);
    expect(matched).toBe(2);
    const hello = parsed.items[0];
    if (hello.type === "entry") {
      hello.markedSame = true;
      expect(statusOf(hello)).toBe("same");
    }
    const exported = buildLangFile(parsed.items, "\n");
    expect(exported).toContain("SAME_TRANSLATION:hello=Hallo");
  });

  it("creates missing translation workspace from reference", () => {
    const result = createTranslationFromReference("a=A\n//c\n[b]\nx=Y\n", "en.lang");
    expect(result.entryCount).toBe(2);
    expect(result.text).toContain("MISSING_TRANSLATION:a=A");
    expect(result.text).toContain("MISSING_TRANSLATION:x=Y");
    expect(result.referenceFilename).toBe("en.lang");
  });
});
