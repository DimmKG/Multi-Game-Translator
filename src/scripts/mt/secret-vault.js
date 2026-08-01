"use strict";

(function initializeMtSecretVault() {
  const FORMAT = "necesse-provider-secrets";
  const VERSION = 1;
  const ITERATIONS = 600000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  class SecretVaultError extends Error {
    constructor(code, message, options = {}) {
      super(message || code, options);
      this.name = "SecretVaultError";
      this.code = code;
    }
  }

  function cryptoApi() {
    const api = globalThis.crypto;
    if (!api?.subtle || typeof api.getRandomValues !== "function") {
      throw new SecretVaultError("crypto-unavailable", "Web Crypto is not available.");
    }
    return api;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const value of bytes) binary += String.fromCharCode(value);
    return btoa(binary);
  }

  function base64ToBytes(value, field) {
    try {
      const binary = atob(String(value || ""));
      return Uint8Array.from(binary, character => character.charCodeAt(0));
    } catch {
      throw new SecretVaultError("invalid-format", "Invalid base64 data in " + field + ".");
    }
  }

  function cleanSecrets(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new SecretVaultError("invalid-secrets", "Provider secrets must be an object.");
    }
    const result = {};
    for (const [providerId, fields] of Object.entries(value)) {
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
      const cleanFields = {};
      for (const [fieldId, secret] of Object.entries(fields)) {
        const text = String(secret ?? "");
        if (text) cleanFields[String(fieldId)] = text;
      }
      if (Object.keys(cleanFields).length) result[String(providerId)] = cleanFields;
    }
    return result;
  }

  function metadata(container) {
    return {
      format: container.format,
      version: container.version,
      kdf: container.kdf,
      cipher: container.cipher
    };
  }

  function validateContainer(container) {
    if (!container || typeof container !== "object" || Array.isArray(container)) {
      throw new SecretVaultError("invalid-format", "The encrypted secret file is invalid.");
    }
    if (container.format !== FORMAT) {
      throw new SecretVaultError("invalid-format", "This is not a provider secret vault.");
    }
    if (container.version !== VERSION) {
      throw new SecretVaultError("unsupported-version", "Unsupported provider secret vault version.");
    }
    if (container.kdf?.name !== "PBKDF2" || container.kdf?.hash !== "SHA-256" || container.kdf?.iterations !== ITERATIONS) {
      throw new SecretVaultError("unsupported-kdf", "Unsupported key derivation settings.");
    }
    if (container.cipher?.name !== "AES-GCM" || container.cipher?.length !== 256) {
      throw new SecretVaultError("unsupported-cipher", "Unsupported encryption settings.");
    }
    if (typeof container.ciphertext !== "string") {
      throw new SecretVaultError("invalid-format", "The encrypted payload is missing.");
    }
    return container;
  }

  async function deriveKey(passphrase, salt, usages) {
    const password = String(passphrase || "");
    if (!password) throw new SecretVaultError("passphrase-required", "A passphrase is required.");
    const api = cryptoApi();
    const material = await api.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return api.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      usages
    );
  }

  async function encrypt(secrets, passphrase) {
    const api = cryptoApi();
    const salt = api.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = api.getRandomValues(new Uint8Array(IV_BYTES));
    const container = {
      format: FORMAT,
      version: VERSION,
      kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: ITERATIONS,
        salt: bytesToBase64(salt)
      },
      cipher: {
        name: "AES-GCM",
        length: 256,
        iv: bytesToBase64(iv)
      }
    };
    const key = await deriveKey(passphrase, salt, ["encrypt"]);
    const additionalData = encoder.encode(JSON.stringify(metadata(container)));
    const plaintext = encoder.encode(JSON.stringify({ secrets: cleanSecrets(secrets) }));
    const ciphertext = await api.subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, plaintext);
    return JSON.stringify({ ...container, ciphertext: bytesToBase64(new Uint8Array(ciphertext)) }, null, 2);
  }

  async function decrypt(serialized, passphrase) {
    let parsed;
    try {
      parsed = JSON.parse(String(serialized || ""));
    } catch {
      throw new SecretVaultError("invalid-format", "The encrypted secret file is not valid JSON.");
    }
    const container = validateContainer(parsed);
    const salt = base64ToBytes(container.kdf.salt, "kdf.salt");
    const iv = base64ToBytes(container.cipher.iv, "cipher.iv");
    const ciphertext = base64ToBytes(container.ciphertext, "ciphertext");
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || !ciphertext.length) {
      throw new SecretVaultError("invalid-format", "The encrypted secret file has invalid lengths.");
    }
    const api = cryptoApi();
    const key = await deriveKey(passphrase, salt, ["decrypt"]);
    const additionalData = encoder.encode(JSON.stringify(metadata(container)));
    try {
      const plaintext = await api.subtle.decrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, ciphertext);
      const payload = JSON.parse(decoder.decode(plaintext));
      return cleanSecrets(payload?.secrets || {});
    } catch (error) {
      if (error instanceof SecretVaultError) throw error;
      throw new SecretVaultError("decryption-failed", "The passphrase is incorrect or the file was modified.", { cause: error });
    }
  }

  globalThis.NecesseMtSecretVault = Object.freeze({
    encrypt,
    decrypt,
    format: FORMAT,
    version: VERSION,
    iterations: ITERATIONS,
    SecretVaultError
  });
})();
