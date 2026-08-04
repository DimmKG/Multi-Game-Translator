// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import type { TerminologyCorpusFile } from "./extract-candidates";
import { validateTerminologyInputs } from "./input-validation";

function corpus(
  languageCode: string,
  filename: string,
  lines: readonly string[],
): TerminologyCorpusFile {
  return { languageCode, filename, text: lines.join("\n") };
}

describe("validateTerminologyInputs", () => {
  const source = corpus("en", "en.lang", ["one=One", "two=Two"]);

  it("accepts distinct aligned source and target files", () => {
    expect(
      validateTerminologyInputs(source, [corpus("bg", "bg.lang", ["one=Едно", "two=Две"])]),
    ).toEqual([]);
  });

  it("reports invalid and duplicate language codes", () => {
    const problems = validateTerminologyInputs(source, [
      corpus("en", "bg.lang", ["one=Едно"]),
      corpus("en", "de.lang", ["one=Eins"]),
      corpus("", "empty.lang", ["one=Uno"]),
    ]);

    expect(problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining([
        "source-target-language-match",
        "duplicate-target-language",
        "invalid-target-language",
      ]),
    );
  });

  it("reports duplicate and reused files", () => {
    const problems = validateTerminologyInputs(source, [
      corpus("bg", "en.lang", ["one=Едно"]),
      corpus("de", "copy.lang", ["one=Eins"]),
      corpus("fr", "COPY.lang", ["one=Un"]),
    ]);

    expect(problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(["source-file-used-as-target", "duplicate-target-file"]),
    );
  });

  it("reports targets with no aligned entries", () => {
    expect(validateTerminologyInputs(source, [corpus("bg", "bg.lang", ["other=Друго"])])).toEqual([
      {
        code: "no-aligned-entries",
        filename: "bg.lang",
        languageCode: "bg",
      },
    ]);
  });

  it("reports an invalid source language code", () => {
    expect(
      validateTerminologyInputs(corpus("english language", "en.lang", ["one=One"]), [
        corpus("bg", "bg.lang", ["one=Едно"]),
      ]),
    ).toEqual([
      {
        code: "invalid-source-language",
        filename: "en.lang",
        languageCode: "english language",
      },
    ]);
  });
});
