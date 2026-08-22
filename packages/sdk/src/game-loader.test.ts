// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  defaultLoaderConfig,
  resolveLoaderConfigSchema,
  type LoaderConfigField,
} from "./game-loader";

const SCHEMA: LoaderConfigField[] = [
  { key: "contextAsKey", type: "boolean", labelKey: "x.a", default: false },
  { key: "delimiter", type: "string", labelKey: "x.b", default: "," },
  {
    key: "column",
    type: "enum",
    labelKey: "x.c",
    default: "source",
    options: [
      { value: "source", labelKey: "x.c.source" },
      { value: "target", labelKey: "x.c.target" },
    ],
  },
];

describe("defaultLoaderConfig", () => {
  it("collects every field's default, keyed by field", () => {
    expect(defaultLoaderConfig(SCHEMA)).toEqual({
      contextAsKey: false,
      delimiter: ",",
      column: "source",
    });
  });

  it("is total for an absent schema — an empty object, not a throw", () => {
    expect(defaultLoaderConfig(undefined)).toEqual({});
  });
});

describe("resolveLoaderConfigSchema", () => {
  it("returns a static array schema as-is, ignoring the file input", () => {
    expect(resolveLoaderConfigSchema(SCHEMA, { files: [] })).toBe(SCHEMA);
  });

  it("calls a function schema with the dropped-file input — a CSV-style loader can derive fields from real file content", () => {
    const schema = resolveLoaderConfigSchema(
      (input) => [
        {
          key: "sourceColumn",
          type: "enum",
          labelKey: "csv.sourceColumn",
          default: input.files[0]?.name ?? "",
          options: input.files.map((file) => ({ value: file.name, labelKey: file.name })),
        },
      ],
      { files: [{ name: "en.csv", text: "a,b\n1,2\n" }] },
    );
    expect(schema).toEqual([expect.objectContaining({ key: "sourceColumn", default: "en.csv" })]);
  });

  it("is total for an absent schema — empty array, not a throw", () => {
    expect(resolveLoaderConfigSchema(undefined, { files: [] })).toEqual([]);
  });
});
