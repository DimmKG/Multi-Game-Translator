// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModSdk } from "@mgt/sdk";
import { necesseGameLoader } from "./game-loader";

export { necesseGameLoader } from "./game-loader";
export { necesseEntryExt, necesseStatusStrategy, type NecesseEntryExt } from "./status";
export { NECESSE_PLACEHOLDER_PATTERN, necessePlaceholderTokenizer } from "./placeholders";
export { buildReferenceQueues, referenceIdentity } from "./reference";
export {
  ENGLISH_ENGNAME_VALUE,
  ENGLISH_REFERENCE_FILENAME,
  hasEnglishEngname,
  normalizeEnglishReferenceFilename,
  validateEnglishReferenceFile,
} from "./validate-reference";
export { MISSING_TRANSLATION_PREFIX, SAME_TRANSLATION_PREFIX, stripStatusPrefix } from "./markers";
export {
  cleanNecesseFilename,
  parseNecesseRawFile,
  type NecesseRawFile,
  type NecesseRawLine,
} from "./raw-lines";
export { necesseLineDialect } from "./line-dialect";

/** Entry point the host calls after dynamically import()-ing this mod. */
export default function register(sdk: ModSdk): void {
  sdk.registerGameLoader(necesseGameLoader);
}
