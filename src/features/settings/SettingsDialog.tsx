import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/features/i18n/I18nProvider";
import { SecretVaultPanel } from "@/features/mt/SecretVaultPanel";
import { useWorkspace } from "@/state/workspace-store";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { settings, setSettings, fonts, setFonts, providers } = useWorkspace();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.intro")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-3 flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="general">{t("settings.tab.general")}</TabsTrigger>
            <TabsTrigger value="fonts">{t("settings.tab.fonts")}</TabsTrigger>
            <TabsTrigger value="mt">{t("settings.tab.machine-translation")}</TabsTrigger>
            <TabsTrigger value="secrets">{t("settings.tab.secrets")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <label className="border-border flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                checked={settings.referenceReminder}
                onCheckedChange={(checked) => setSettings({ referenceReminder: checked === true })}
              />
              <span className="grid gap-1">
                <strong>{t("settings.referenceReminder")}</strong>
                <span className="text-muted-foreground text-xs">
                  {t("settings.referenceReminderHint")}
                </span>
              </span>
            </label>
          </TabsContent>

          <TabsContent value="fonts" className="grid gap-4">
            <p className="text-muted-foreground text-sm">{t("settings.font.hint")}</p>
            {(
              [
                ["interface", "interfacePreset", "interfaceCustom"],
                ["editor", "editorPreset", "editorCustom"],
              ] as const
            ).map(([labelKey, presetKey, customKey]) => (
              <div key={labelKey} className="grid gap-2">
                <Label>{t(`settings.font.${labelKey}`)}</Label>
                <Select
                  value={fonts[presetKey]}
                  onValueChange={(value) => setFonts({ [presetKey]: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{t("settings.font.default")}</SelectItem>
                    <SelectItem value="system">{t("settings.font.system")}</SelectItem>
                    <SelectItem value="serif">{t("settings.font.serif")}</SelectItem>
                    <SelectItem value="mono">{t("settings.font.mono")}</SelectItem>
                    <SelectItem value="custom">{t("settings.font.custom")}</SelectItem>
                  </SelectContent>
                </Select>
                {fonts[presetKey] === "custom" && (
                  <Input
                    value={fonts[customKey]}
                    placeholder={t("settings.font.custom")}
                    onChange={(event) => setFonts({ [customKey]: event.target.value })}
                  />
                )}
              </div>
            ))}
            <p className="border-border bg-muted/40 rounded-md border p-3 text-sm">
              {t("settings.font.preview")}
            </p>
          </TabsContent>

          <TabsContent value="mt" className="text-muted-foreground space-y-3 text-sm">
            <p>
              {providers.map((provider) => provider.name).join(", ") || "Google"} —{" "}
              {t("mt.providerTitle")}
            </p>
            <p>{t("mt.providerTitle")}</p>
          </TabsContent>

          <TabsContent value="secrets">
            <SecretVaultPanel />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("settings.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
