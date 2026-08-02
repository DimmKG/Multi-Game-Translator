import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearProviderSecrets,
  exportProviderSecrets,
  importProviderSecrets,
  providerSecretCount,
} from "@/core/mt/provider-settings";
import { decryptSecrets, encryptSecrets } from "@/core/mt/secret-vault";
import { useI18n } from "@/features/i18n/I18nProvider";
import { downloadText, readFileAsText } from "@/lib/utils";

export function SecretVaultPanel() {
  const { t } = useI18n();
  const [passphrase, setPassphrase] = useState("");
  const [count, setCount] = useState(providerSecretCount());

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="text-sm font-medium">{t("settings.secretVaultTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("settings.secretVaultHint")}</p>
      </div>

      <p className="text-sm">
        {count > 0
          ? t("settings.secretVaultUnlocked", { n: count })
          : t("settings.secretVaultEmpty")}
      </p>

      <div className="grid gap-2">
        <Label htmlFor="vault-pass">{t("settings.secretVaultPassword")}</Label>
        <Input
          id="vault-pass"
          type="password"
          autoComplete="new-password"
          value={passphrase}
          placeholder={t("settings.secretVaultPassword")}
          onChange={(event) => setPassphrase(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={count === 0}
          onClick={async () => {
            try {
              const serialized = await encryptSecrets(exportProviderSecrets(), passphrase);
              downloadText("provider-secrets.json", serialized, "application/json");
              toast.success(t("settings.secretVaultExported"));
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : t("settings.secretVaultExportError"),
              );
            }
          }}
        >
          {t("settings.secretVaultExport")}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json,application/json";
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              void (async () => {
                try {
                  const text = await readFileAsText(file);
                  const secrets = await decryptSecrets(text, passphrase);
                  importProviderSecrets(secrets);
                  setCount(providerSecretCount());
                  toast.success(t("settings.secretVaultImported"));
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : t("settings.secretVaultImportError"),
                  );
                }
              })();
            };
            input.click();
          }}
        >
          {t("settings.secretVaultImport")}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          disabled={count === 0}
          onClick={() => {
            clearProviderSecrets();
            setCount(0);
            toast.success(t("settings.secretVaultCleared"));
          }}
        >
          {t("settings.secretVaultClear")}
        </Button>
      </div>
    </div>
  );
}
