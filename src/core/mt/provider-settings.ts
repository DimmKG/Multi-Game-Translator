import type { MtProviderSettingField } from "./providers";

const STORAGE_KEY = "necesse-translator.mt-provider-settings.v1";

const schemas = new Map<string, readonly MtProviderSettingField[]>();
const publicSettings: Record<string, Record<string, string>> = restorePublicSettings();
const secrets = new Map<string, Map<string, string>>();

function restorePublicSettings(): Record<string, Record<string, string>> {
  try {
    if (typeof localStorage === "undefined") return {};
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function persistPublicSettings() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(publicSettings));
}

function normalizeField(field: MtProviderSettingField): MtProviderSettingField {
  if (!field || typeof field.id !== "string" || !field.id.trim()) {
    throw new TypeError("Provider setting fields require an id.");
  }
  const type = field.type === "secret" ? "secret" : "text";
  return Object.freeze({
    id: field.id.trim(),
    type,
    labelKey: String(field.labelKey || ""),
    hintKey: String(field.hintKey || ""),
    placeholder: String(field.placeholder || ""),
    required: Boolean(field.required),
    defaultValue: type === "secret" ? "" : String(field.defaultValue || ""),
  });
}

export function defineProviderSettings(providerId: string, fields: MtProviderSettingField[] = []) {
  const id = String(providerId || "").trim();
  if (!id) throw new TypeError("A provider id is required.");
  if (schemas.has(id)) throw new TypeError(`Duplicate provider settings schema: ${id}`);
  const normalized = Object.freeze(fields.map(normalizeField));
  const duplicates = normalized.filter(
    (field, index) => normalized.findIndex((item) => item.id === field.id) !== index,
  );
  if (duplicates.length)
    throw new TypeError(`Duplicate provider setting field: ${duplicates[0].id}`);
  schemas.set(id, normalized);
  return normalized;
}

export function providerSettingsSchema(providerId: string) {
  return schemas.get(String(providerId || "")) || Object.freeze([]);
}

function fieldDefinition(providerId: string, fieldId: string) {
  return (
    providerSettingsSchema(providerId).find((field) => field.id === String(fieldId || "")) || null
  );
}

export function getPublicProviderSetting(providerId: string) {
  const values = publicSettings[String(providerId || "")];
  return values && typeof values === "object" && !Array.isArray(values) ? { ...values } : {};
}

export function setPublicProviderSetting(providerId: string, fieldId: string, value: string) {
  const provider = String(providerId || "");
  const field = fieldDefinition(provider, fieldId);
  if (!field || field.type === "secret")
    throw new TypeError("Unknown non-secret provider setting.");
  if (!publicSettings[provider] || typeof publicSettings[provider] !== "object") {
    publicSettings[provider] = {};
  }
  publicSettings[provider][field.id] = String(value ?? "");
  persistPublicSettings();
}

function secretBucket(providerId: string, create = false) {
  const id = String(providerId || "");
  if (!secrets.has(id) && create) secrets.set(id, new Map());
  return secrets.get(id) || null;
}

export function setProviderSecret(providerId: string, fieldId: string, value: string) {
  const provider = String(providerId || "");
  const field = fieldDefinition(provider, fieldId);
  if (!field || field.type !== "secret") throw new TypeError("Unknown secret provider setting.");
  const bucket = secretBucket(provider, true)!;
  const text = String(value ?? "");
  if (text) bucket.set(field.id, text);
  else bucket.delete(field.id);
}

export function getProviderSecret(providerId: string, fieldId: string) {
  return secretBucket(providerId)?.get(String(fieldId || "")) || "";
}

export function clearProviderSecrets(providerId?: string) {
  if (providerId === undefined) secrets.clear();
  else secrets.delete(String(providerId || ""));
}

export function exportProviderSecrets() {
  const result: Record<string, Record<string, string>> = {};
  for (const [providerId, bucket] of secrets) {
    const fields: Record<string, string> = {};
    for (const [fieldId, value] of bucket) if (value) fields[fieldId] = value;
    if (Object.keys(fields).length) result[providerId] = fields;
  }
  return result;
}

export function importProviderSecrets(
  snapshot: Record<string, Record<string, string>>,
  options: { replace?: boolean } = {},
) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Provider secret snapshot must be an object.");
  }
  if (options.replace !== false) secrets.clear();
  for (const [providerId, fields] of Object.entries(snapshot)) {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
    for (const [fieldId, value] of Object.entries(fields)) {
      const field = fieldDefinition(providerId, fieldId);
      if (!field || field.type !== "secret") continue;
      const text = String(value ?? "");
      if (text) secretBucket(providerId, true)!.set(field.id, text);
    }
  }
  return exportProviderSecrets();
}

export function providerSecretCount() {
  let count = 0;
  for (const bucket of secrets.values()) count += bucket.size;
  return count;
}

export function resolveProviderSettings(providerId: string) {
  const provider = String(providerId || "");
  const publicValues = getPublicProviderSetting(provider);
  const result: Record<string, string> = {};
  for (const field of providerSettingsSchema(provider)) {
    result[field.id] =
      field.type === "secret"
        ? getProviderSecret(provider, field.id)
        : (publicValues[field.id] ?? field.defaultValue ?? "");
  }
  return result;
}
