// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModSdk } from "@mgt/sdk";
import { genericIniGameLoader } from "./game-loader";

export { genericIniGameLoader } from "./game-loader";

/** Entry point the host calls after dynamically import()-ing this mod. */
export default function register(sdk: ModSdk): void {
  sdk.registerGameLoader(genericIniGameLoader);
}
