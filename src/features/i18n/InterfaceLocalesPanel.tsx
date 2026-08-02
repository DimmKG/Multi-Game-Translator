// SPDX-License-Identifier: AGPL-3.0-or-later
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "./I18nProvider";

export function InterfaceLocalesPanel() {
  const { t, installedLocales, installLocaleFile, removeInstalledLocale, downloadLocaleTemplate } =
    useI18n();

  const importLocale = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void installLocaleFile(file)
        .then(({ locale, replaced }) => {
          toast.success(
            t(replaced ? "interfaceLocales.replaced" : "interfaceLocales.loaded", {
              name: locale.nativeName,
            }),
          );
        })
        .catch((error: Error) => toast.error(t("interfaceLocales.error") + error.message));
    };
    input.click();
  };

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">{t("interfaceLocales.intro")}</p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={importLocale}>
          {t("interfaceLocales.import")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={downloadLocaleTemplate}>
          {t("interfaceLocales.export")}
        </Button>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">{t("interfaceLocales.installed")}</h3>
        {installedLocales.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("interfaceLocales.empty")}</p>
        ) : (
          installedLocales.map((locale) => (
            <div
              key={locale.code}
              className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <strong>
                  {locale.nativeName} ({locale.code})
                </strong>
                <p className="text-muted-foreground text-xs">
                  {[
                    t("interfaceLocales.messages", {
                      n: Object.keys(locale.messages).length,
                    }),
                    locale.updatedAt,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  removeInstalledLocale(locale.code);
                  toast.success(
                    t("interfaceLocales.removed", {
                      name: locale.nativeName,
                    }),
                  );
                }}
              >
                {t("interfaceLocales.remove")}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
