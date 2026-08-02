// SPDX-License-Identifier: AGPL-3.0-or-later
import path from "node:path";
import type { Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const SPDX = "SPDX-License-Identifier: AGPL-3.0-or-later";
const SPDX_BANNER = `/*! ${SPDX} */`;
const VENDOR_CHUNK_NAMES = new Set(["react", "radix", "icons", "vendor"]);

function isVendorJsChunk(item: { name: string | undefined; moduleIds: string[] }): boolean {
  if (item.name && VENDOR_CHUNK_NAMES.has(item.name)) return true;
  return item.moduleIds.length > 0 && item.moduleIds.every((id) => id.includes("node_modules"));
}

function isVendorCssAsset(fileName: string): boolean {
  return /(^|\/)vendor-[^/]+\.css$/.test(fileName);
}

/**
 * Stamp our own emitted JS/CSS with SPDX at byte 0.
 * Skip vendor library chunks (react/radix/icons/vendor) — those keep upstream licenses.
 * Rollup's `output.banner` lands after `import`s in ESM chunks, which hides
 * the marker at the top of entry files like `index-*.js`.
 */
function spdxBanner(): Plugin {
  return {
    name: "spdx-banner",
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type === "chunk") {
          if (isVendorJsChunk(item)) continue;
          const code = item.code.replaceAll(SPDX_BANNER, "").replace(/^\n+/, "");
          item.code = `${SPDX_BANNER}\n${code}`;
          continue;
        }
        if (item.type !== "asset" || !item.fileName.endsWith(".css")) continue;
        if (isVendorCssAsset(item.fileName)) continue;
        const source =
          typeof item.source === "string" ? item.source : Buffer.from(item.source).toString("utf8");
        if (source.startsWith(SPDX_BANNER)) continue;
        item.source = `${SPDX_BANNER}\n${source.replaceAll(SPDX_BANNER, "")}`;
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";

  return {
    base: "./",
    plugins: [react(), tailwindcss(), spdxBanner()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      assetsInlineLimit: standalone ? Number.MAX_SAFE_INTEGER : undefined,
      cssCodeSplit: !standalone,
      rollupOptions: {
        output: standalone
          ? {
              inlineDynamicImports: true,
            }
          : {
              /**
               * One 700 kB file meant every release invalidated the whole download,
               * even when only our own code had changed. Split along the lines that
               * actually move at different rates: the framework almost never, the
               * widget libraries rarely, the interface locales on their own schedule,
               * the app constantly.
               */
              manualChunks(id) {
                if (id.includes("/src/locales/")) return "locales";
                if (!id.includes("node_modules")) return undefined;
                // React and the renderer share module-level state; keeping them in
                // one chunk avoids any question of initialisation order.
                if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
                if (/node_modules\/(@radix-ui|radix-ui|aria-hidden|react-remove-scroll)/.test(id)) {
                  return "radix";
                }
                if (id.includes("node_modules/lucide-react/")) return "icons";
                return "vendor";
              },
            },
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    },
    server: {
      host: "127.0.0.1",
      port: 4173,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
    },
  };
});
