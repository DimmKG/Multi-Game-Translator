import { readFile, writeFile } from "node:fs/promises";

const manifestPath = "src/scripts/i18n/locales/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const affectedKeys = [
  "btn.enRef",
  "btn.enRefTitle",
  "btn.enRefLoaded",
  "btn.enRefLoadedTitle",
  "filter.same",
  "card.enOriginal",
  "badge.same",
  "mt.langLabel",
  "mt.btnTitle",
  "mt.needEnRef",
  "mt.emptySrc",
  "same.on",
  "same.off",
  "same.title",
  "rflag.sameEng",
  "review.enLabel",
  "review.noRef",
  "footnote.same",
  "toast.enMatched",
  "settings.referenceReminder",
  "settings.referenceReminderHint"
];

for (const entry of manifest.locales) {
  if (entry.reviewed) continue;
  const path = `src/scripts/i18n/locales/${entry.file}`;
  const locale = JSON.parse(await readFile(path, "utf8"));
  for (const key of affectedKeys) delete locale.messages[key];
  await writeFile(path, JSON.stringify(locale, null, 2) + "\n", "utf8");
}

console.log("Removed stale reference wording from provisional locales.");
