// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { parseNecesseRawFile } from "./raw-lines";

describe("parseNecesseRawFile", () => {
  it("preserves sections, markers and CRLF", () => {
    const source = "[misc]\r\nMISSING_TRANSLATION:hello=Hello\r\nSAME_TRANSLATION:bye=Bye\r\n";
    const parsed = parseNecesseRawFile(source);
    expect(parsed.eol).toBe("\r\n");
    expect(parsed.items[0]).toMatchObject({ type: "section", name: "[misc]" });
    expect(parsed.items[1]).toMatchObject({
      type: "entry",
      key: "hello",
      wasMissing: true,
      value: "Hello",
    });
    expect(parsed.items[2]).toMatchObject({ type: "entry", key: "bye", markedSame: true });
  });

  it("classifies blank and comment lines", () => {
    const parsed = parseNecesseRawFile("\n// a comment\nhello=Hello\n");
    expect(parsed.items[0]).toMatchObject({ type: "blank" });
    expect(parsed.items[1]).toMatchObject({ type: "comment" });
    expect(parsed.items[2]).toMatchObject({ type: "entry", key: "hello" });
  });
});
