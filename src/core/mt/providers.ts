// SPDX-License-Identifier: AGPL-3.0-or-later
import { maskProtectedTokens } from "@/core/tokens/protected";

export class MtProviderError extends Error {
  code: string;
  provider: string;
  status: number;

  constructor(code: string, message: string, options: { provider?: string; status?: number } = {}) {
    super(message || code);
    this.name = "MtProviderError";
    this.code = code;
    this.provider = options.provider || "";
    this.status = options.status || 0;
  }
}

export interface MtProviderSettingField {
  id: string;
  type: "text" | "secret";
  labelKey?: string;
  hintKey?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface MtTranslateRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  signal?: AbortSignal;
  settings: Record<string, string>;
}

export interface MtProviderDefinition {
  id: string;
  name?: string;
  default?: boolean;
  settings?: MtProviderSettingField[];
  normalizeLanguage?: (code: string) => string;
  translate: (request: MtTranslateRequest) => Promise<string>;
}

export interface MtProvider {
  id: string;
  name: string;
  normalizeLanguage: (code: string) => string;
  settings: readonly MtProviderSettingField[];
  translate: (request: MtTranslateRequest) => Promise<string>;
}

const providers = new Map<string, MtProvider>();
let defaultProviderId = "";
let resolveSettings: (providerId: string) => Record<string, string> = () => ({});

export function setSettingsResolver(resolver: (providerId: string) => Record<string, string>) {
  resolveSettings = resolver;
}

export function registerProvider(definition: MtProviderDefinition): MtProvider {
  if (!definition || typeof definition.id !== "string" || !definition.id.trim()) {
    throw new TypeError("A machine-translation provider id is required.");
  }
  if (typeof definition.translate !== "function") {
    throw new TypeError(`Provider ${definition.id} must define translate().`);
  }
  const id = definition.id.trim();
  if (providers.has(id)) throw new TypeError(`Duplicate machine-translation provider: ${id}`);
  const settings = Array.isArray(definition.settings) ? definition.settings : [];
  const provider: MtProvider = Object.freeze({
    id,
    name: definition.name || id,
    normalizeLanguage:
      typeof definition.normalizeLanguage === "function"
        ? definition.normalizeLanguage
        : (code: string) => String(code || "").trim(),
    settings: Object.freeze([...settings]),
    translate: definition.translate,
  });
  providers.set(id, provider);
  if (!defaultProviderId || definition.default) defaultProviderId = id;
  return provider;
}

export function getProvider(id: string) {
  return providers.get(String(id || "")) || null;
}

export function getAllProviders() {
  return [...providers.values()];
}

export function getDefaultProviderId() {
  return defaultProviderId;
}

export async function translateWithProvider(
  id: string | undefined,
  request: {
    text: string;
    sourceLanguage?: string;
    targetLanguage: string;
    signal?: AbortSignal;
    maskTokens?: boolean;
  },
) {
  const provider = getProvider(id || defaultProviderId);
  if (!provider) {
    throw new MtProviderError("unknown-provider", "Unknown machine-translation provider.", {
      provider: id,
    });
  }
  const targetLanguage = provider.normalizeLanguage(request.targetLanguage);
  const sourceLanguage = provider.normalizeLanguage(request.sourceLanguage || "en");
  if (!targetLanguage) {
    throw new MtProviderError("target-language-required", "A target language is required.", {
      provider: provider.id,
    });
  }

  const settings = resolveSettings(provider.id);
  const shouldMask = request.maskTokens !== false;
  const { maskedText, restore } = shouldMask
    ? maskProtectedTokens(String(request.text || ""))
    : { maskedText: String(request.text || ""), restore: (value: string) => value };

  const translated = await provider.translate({
    text: maskedText,
    sourceLanguage,
    targetLanguage,
    signal: request.signal,
    settings,
  });
  return restore(translated);
}

function normalizeGoogleLanguage(code: string) {
  let value = String(code || "")
    .trim()
    .replace(/_/g, "-");
  if (!value) return "";
  if (/^pr(-br)?$/i.test(value)) value = `pt${value.slice(2)}`;
  const aliases: Record<string, string> = {
    "pt-br": "pt",
    "pt-pt": "pt",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
    "zh-hk": "zh-TW",
    "es-419": "es",
    "es-es": "es",
    "es-mx": "es",
    "en-us": "en",
    "en-gb": "en",
    "nb-no": "no",
    "nn-no": "no",
  };
  return aliases[value.toLowerCase()] || value;
}

registerProvider({
  id: "google",
  name: "Google",
  default: true,
  settings: [],
  normalizeLanguage: normalizeGoogleLanguage,
  async translate({ text, sourceLanguage, targetLanguage, signal }) {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
      encodeURIComponent(sourceLanguage) +
      "&tl=" +
      encodeURIComponent(targetLanguage) +
      "&dt=t&q=" +
      encodeURIComponent(text);
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new MtProviderError("http-error", `Google ${response.status}`, {
        provider: "google",
        status: response.status,
      });
    }
    const payload = await response.json();
    const segments = payload && payload[0];
    if (!Array.isArray(segments)) {
      throw new MtProviderError("invalid-response", "Google returned an invalid response.", {
        provider: "google",
      });
    }
    return segments
      .map((segment: unknown) => (Array.isArray(segment) && segment[0] ? segment[0] : ""))
      .join("");
  },
});
