import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
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
});
