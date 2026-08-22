// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModSdk } from "@mgt/sdk";
import { factorioGameLoader } from "./game-loader";

export { factorioGameLoader } from "./game-loader";
export { FACTORIO_PLACEHOLDER_PATTERN, factorioPlaceholderTokenizer } from "./placeholders";
export {
  buildFactorioPluralExpression,
  parseFactorioPluralExpression,
  type FactorioPluralBucket,
  type FactorioPluralExpression,
} from "./plural-subgrammar";

/** Entry point the host calls after dynamically import()-ing this mod. */
export default function register(sdk: ModSdk): void {
  sdk.registerGameLoader(factorioGameLoader);
}
