// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModSdk } from "@mgt/sdk";
import { necesseGameLoader } from "./game-loader";

export { necesseGameLoader } from "./game-loader";
export { necesseEntryExt, necesseStatusStrategy, type NecesseEntryExt } from "./status";
export { necessePlaceholderTokenizer } from "./placeholders";
export { buildReferenceQueues, referenceIdentity } from "./reference";
export {
  ENGLISH_ENGNAME_VALUE,
  ENGLISH_REFERENCE_FILENAME,
  hasEnglishEngname,
  normalizeEnglishReferenceFilename,
  validateEnglishReferenceFile,
} from "./validate-reference";

/** Entry point the host calls after dynamically import()-ing this mod. */
export default function register(sdk: ModSdk): void {
  sdk.registerGameLoader(necesseGameLoader);
}
