// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  createEnglishInterfaceLocaleTemplate,
  normalizeInterfaceLocale,
} from "./interface-locale-packages";

describe("interface locale packages", () => {
  it("accepts partial locale packages that use known English keys", () => {
    const locale = normalizeInterfaceLocale({
      format: "necesse-interface-locale",
      version: 1,
      code: "eo",
      name: "Esperanto",
      nativeName: "Esperanto",
      authors: ["Translator"],
      updatedAt: "2026-08-02",
      messages: {
        "app.title": "Necesse — tradukilo",
      },
    });

    expect(locale.code).toBe("eo");
    expect(locale.messages["app.title"]).toBe("Necesse — tradukilo");
  });

  it("rejects replacement of every built-in locale, not only reviewed locales", () => {
    expect(() =>
      normalizeInterfaceLocale({
        format: "necesse-interface-locale",
        version: 1,
        code: "de",
        name: "German",
        nativeName: "Deutsch",
        messages: { "app.title": "Necesse — Übersetzer" },
      }),
    ).toThrow(/Built-in locale/);
  });

  it("rejects unknown message keys", () => {
    expect(() =>
      normalizeInterfaceLocale({
        format: "necesse-interface-locale",
        version: 1,
        code: "eo",
        name: "Esperanto",
        nativeName: "Esperanto",
        messages: { "not.a.real.key": "Ne" },
      }),
    ).toThrow(/Unknown interface message key/);
  });

  it("exports a complete English template", () => {
    const template = createEnglishInterfaceLocaleTemplate();
    expect(template.format).toBe("necesse-interface-locale");
    expect(template.version).toBe(1);
    expect(template.messages["app.title"]).toBeTruthy();
    expect(Object.keys(template.messages).length).toBeGreaterThan(100);
  });
});
