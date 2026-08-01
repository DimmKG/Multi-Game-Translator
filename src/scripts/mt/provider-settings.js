"use strict";

(function initializeMtProviderSettings() {
  const STORAGE_KEY = "necesse-translator.mt-provider-settings.v1";
  const schemas = new Map();
  const publicSettings = restorePublicSettings();
  const secrets = new Map();

  function restorePublicSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function persistPublicSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(publicSettings));
  }

  function normalizeField(field) {
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
      defaultValue: type === "secret" ? "" : String(field.defaultValue || "")
    });
  }

  function define(providerId, fields = []) {
    const id = String(providerId || "").trim();
    if (!id) throw new TypeError("A provider id is required.");
    if (schemas.has(id)) throw new TypeError("Duplicate provider settings schema: " + id);
    const normalized = Object.freeze(fields.map(normalizeField));
    const duplicates = normalized.filter((field, index) => normalized.findIndex(item => item.id === field.id) !== index);
    if (duplicates.length) throw new TypeError("Duplicate provider setting field: " + duplicates[0].id);
    schemas.set(id, normalized);
    return normalized;
  }

  function schema(providerId) {
    return schemas.get(String(providerId || "")) || Object.freeze([]);
  }

  function fieldDefinition(providerId, fieldId) {
    return schema(providerId).find(field => field.id === String(fieldId || "")) || null;
  }

  function getPublic(providerId) {
    const id = String(providerId || "");
    const values = publicSettings[id];
    return values && typeof values === "object" && !Array.isArray(values) ? { ...values } : {};
  }

  function setPublic(providerId, fieldId, value) {
    const provider = String(providerId || "");
    const field = fieldDefinition(provider, fieldId);
    if (!field || field.type === "secret") throw new TypeError("Unknown non-secret provider setting.");
    if (!publicSettings[provider] || typeof publicSettings[provider] !== "object") publicSettings[provider] = {};
    publicSettings[provider][field.id] = String(value ?? "");
    persistPublicSettings();
  }

  function secretBucket(providerId, create = false) {
    const id = String(providerId || "");
    if (!secrets.has(id) && create) secrets.set(id, new Map());
    return secrets.get(id) || null;
  }

  function notifySecretsChanged() {
    globalThis.dispatchEvent?.(new CustomEvent("necesse:mt-secrets-changed"));
  }

  function setSecret(providerId, fieldId, value) {
    const provider = String(providerId || "");
    const field = fieldDefinition(provider, fieldId);
    if (!field || field.type !== "secret") throw new TypeError("Unknown secret provider setting.");
    const bucket = secretBucket(provider, true);
    const text = String(value ?? "");
    if (text) bucket.set(field.id, text);
    else bucket.delete(field.id);
    notifySecretsChanged();
  }

  function getSecret(providerId, fieldId) {
    return secretBucket(providerId)?.get(String(fieldId || "")) || "";
  }

  function clearSecrets(providerId) {
    if (providerId === undefined) secrets.clear();
    else secrets.delete(String(providerId || ""));
    notifySecretsChanged();
  }

  function exportSecrets() {
    const result = {};
    for (const [providerId, bucket] of secrets) {
      const fields = {};
      for (const [fieldId, value] of bucket) if (value) fields[fieldId] = value;
      if (Object.keys(fields).length) result[providerId] = fields;
    }
    return result;
  }

  function importSecrets(snapshot, options = {}) {
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
        if (text) secretBucket(providerId, true).set(field.id, text);
      }
    }
    notifySecretsChanged();
    return exportSecrets();
  }

  function secretCount() {
    let count = 0;
    for (const bucket of secrets.values()) count += bucket.size;
    return count;
  }

  function resolve(providerId) {
    const provider = String(providerId || "");
    const publicValues = getPublic(provider);
    const result = {};
    for (const field of schema(provider)) {
      result[field.id] = field.type === "secret"
        ? getSecret(provider, field.id)
        : (publicValues[field.id] ?? field.defaultValue);
    }
    return result;
  }

  function exportPublic() {
    return JSON.parse(JSON.stringify(publicSettings));
  }

  globalThis.NecesseMtProviderSettings = Object.freeze({
    define,
    schema,
    getPublic,
    setPublic,
    setSecret,
    getSecret,
    clearSecrets,
    exportSecrets,
    importSecrets,
    secretCount,
    resolve,
    exportPublic,
    secretPersistence: "memory-only"
  });
})();
