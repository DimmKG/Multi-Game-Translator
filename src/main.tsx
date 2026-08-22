// SPDX-License-Identifier: AGPL-3.0-or-later
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";
import { bootstrapMods } from "@/state/mod-bootstrap";
import { setModLoadWarnings } from "@/state/mod-bootstrap-warnings";

// WorkspaceProvider's very first render already resolves a game loader by id
// (see workspace-store.tsx's EMPTY_DOCUMENT), so the registry must already be
// populated before .render() is ever called — not just before GameSelect
// mounts. No top-level await: Vite's default build target (browsers with
// native ESM, e.g. Safari 14) predates it.
void (async () => {
  const { failed } = await bootstrapMods();
  setModLoadWarnings(failed);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
})();
