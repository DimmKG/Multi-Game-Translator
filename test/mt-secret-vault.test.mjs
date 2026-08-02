import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/mt/secret-vault.js", import.meta.url), "utf8");

function loadVault() {
  const context = {
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    JSON,
    String,
    Object,
    Error,
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary")
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.NecesseMtSecretVault;
}

test("secret vault round-trips provider secrets", async () => {
  const vault = loadVault();
  const original = {
    deepl: { apiKey: "secret-key" },
    libretranslate: { apiKey: "another-secret" }
  };
  const serialized = await vault.encrypt(original, "correct horse battery staple");
  assert.doesNotMatch(serialized, /secret-key|another-secret/);
  const restored = await vault.decrypt(serialized, "correct horse battery staple");
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), original);
});

test("secret vault uses versioned PBKDF2 and AES-GCM metadata", async () => {
  const vault = loadVault();
  const parsed = JSON.parse(await vault.encrypt({ deepl: { apiKey: "x" } }, "passphrase"));
  assert.equal(parsed.format, "necesse-provider-secrets");
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.kdf.name, "PBKDF2");
  assert.deepEqual(parsed.kdf.hash, "SHA-256");
  assert.equal(parsed.kdf.iterations, 600000);
  assert.equal(parsed.cipher.name, "AES-GCM");
  assert.equal(parsed.cipher.length, 256);
  assert.equal(Buffer.from(parsed.kdf.salt, "base64").length, 16);
  assert.equal(Buffer.from(parsed.cipher.iv, "base64").length, 12);
});

test("wrong passphrases and modified ciphertext fail closed", async () => {
  const vault = loadVault();
  const serialized = await vault.encrypt({ deepl: { apiKey: "x" } }, "right password");
  await assert.rejects(() => vault.decrypt(serialized, "wrong password"), error => error.code === "decryption-failed");

  const modified = JSON.parse(serialized);
  const bytes = Buffer.from(modified.ciphertext, "base64");
  bytes[0] ^= 1;
  modified.ciphertext = bytes.toString("base64");
  await assert.rejects(() => vault.decrypt(JSON.stringify(modified), "right password"), error => error.code === "decryption-failed");
});

test("unsupported versions and empty passphrases are rejected", async () => {
  const vault = loadVault();
  await assert.rejects(() => vault.encrypt({}, ""), error => error.code === "passphrase-required");
  const parsed = JSON.parse(await vault.encrypt({}, "passphrase"));
  parsed.version = 2;
  await assert.rejects(() => vault.decrypt(JSON.stringify(parsed), "passphrase"), error => error.code === "unsupported-version");
});
