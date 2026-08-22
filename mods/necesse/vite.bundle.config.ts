// SPDX-License-Identifier: AGPL-3.0-or-later
import path from "node:path";
import { defineConfig } from "vite";

/**
 * Produces the self-contained browser bundle the host `import()`s at runtime
 * after fetching the mod catalog (see src/state/mod-source.web.ts). Separate
 * from tsc -b's plain `dist/` output: that output is still consumed normally
 * by anything that statically imports "@mgt/mod-necesse" at build time (e.g.
 * the standalone build's mod source), where Rollup resolves the bare
 * "@mgt/sdk" specifier itself. A real browser `import(url)` has no such
 * resolution, so this output must inline @mgt/sdk's runtime helpers instead
 * of externalizing them.
 */
export default defineConfig({
  build: {
    outDir: "dist-bundle",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
  },
});
