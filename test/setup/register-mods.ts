// SPDX-License-Identifier: AGPL-3.0-or-later
import { createModSdk } from "@mgt/sdk";
import registerNecesse from "@mgt/mod-necesse";
import registerGenericIni from "@mgt/mod-generic-ini";

/**
 * Restores pre-registry test behavior: both loaders always available,
 * without any test needing to know about bootstrap/registry mechanics. The
 * real fetch/import() mechanism is already covered by
 * packages/sdk/src/catalog-loader.test.ts.
 */
const sdk = createModSdk();
registerNecesse(sdk);
registerGenericIni(sdk);
