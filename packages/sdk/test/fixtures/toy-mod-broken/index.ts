// SPDX-License-Identifier: LGPL-3.0-or-later
import type { ModSdk } from "../../../src/registry";

/** Throwaway fixture: register() itself throws — proves one broken mod can't take down the others. */
export default function register(_sdk: ModSdk): void {
  throw new Error("toy-mod-broken always fails to register");
}
