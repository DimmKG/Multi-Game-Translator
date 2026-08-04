// SPDX-License-Identifier: AGPL-3.0-or-later

const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export function suggestLanguageCodeFromFilename(filename: string): string {
  const stem = filename.trim().replace(/\.lang$/i, "");
  if (!LANGUAGE_TAG.test(stem)) return "";

  return stem
    .split("-")
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
      if (/^[A-Za-z]{4}$/.test(part)) {
        return part[0].toUpperCase() + part.slice(1).toLowerCase();
      }
      return part.toLowerCase();
    })
    .join("-");
}
