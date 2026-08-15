// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModSdk } from "@mgt/sdk";
import { necesseGameLoader } from "./game-loader";

export { necesseGameLoader } from "./game-loader";
export { necesseStatusStrategy, type NecesseEntryExt } from "./status";
export { necessePlaceholderTokenizer } from "./placeholders";
export {
  ENGLISH_ENGNAME_VALUE,
  ENGLISH_REFERENCE_FILENAME,
  hasEnglishEngname,
  normalizeEnglishReferenceFilename,
  validateEnglishReferenceFile,
} from "./validate-reference";

/** Entry point the host calls after import() — see the architecture doc's Развилка A. */
export default function register(sdk: ModSdk): void {
  sdk.registerGameLoader(necesseGameLoader);
}
