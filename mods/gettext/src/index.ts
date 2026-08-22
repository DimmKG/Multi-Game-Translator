// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModSdk } from "@mgt/sdk";
import { gettextGameLoader } from "./game-loader";

export { gettextGameLoader } from "./game-loader";
export { GETTEXT_PLACEHOLDER_PATTERN, gettextPlaceholderTokenizer } from "./placeholders";

/**
 * Entry point the host calls after dynamically import()-ing this mod. Only
 * the game loader is registered here — poFileLoader is SDK-level
 * infrastructure, registered once in src/state/mod-bootstrap.ts, the same
 * relationship iniFileLoader has to Necesse/generic-ini/Factorio.
 */
export default function register(sdk: ModSdk): void {
  sdk.registerGameLoader(gettextGameLoader);
}
