// SPDX-License-Identifier: AGPL-3.0-or-later
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Game-specific mods shipped as separate import()-ed bundles (public/mods/catalog.json).
// General-purpose loaders (generic-ini) are statically bundled into the main app and
// never appear here.
const DYNAMIC_MODS = ["necesse"];

for (const id of DYNAMIC_MODS) {
  const fromFile = path.join(root, "mods", id, "dist-bundle", "index.js");
  const toDir = path.join(root, "public", "mods", id);
  await mkdir(toDir, { recursive: true });
  await cp(fromFile, path.join(toDir, "index.js"));
  console.log(`Synced ${path.relative(root, fromFile)} -> ${path.relative(root, toDir)}/index.js`);
}
