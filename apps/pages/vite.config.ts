import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// GitHub Pages: aplicația stă la https://bladejhs.github.io/adonis-host/
export default defineConfig({
  base: process.env.PAGES_BASE ?? "/adonis-host/",
  plugins: [react()],
  resolve: {
    alias: {
      // componentele din admin (UI, grafice, editorul de șabloane) se refolosesc ca atare
      "@": path.resolve(__dirname, "../admin/src"),
      "next/link": path.resolve(__dirname, "src/shims/next-link.tsx"),
    },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 1200 },
});
