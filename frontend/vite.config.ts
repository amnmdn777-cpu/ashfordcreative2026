import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@site": path.resolve(root, "src/site"),
      "@admin": path.resolve(root, "src/admin"),
      "@rep": path.resolve(root, "src/rep"),
      "@shared": path.resolve(root, "src/shared"),
      // Shared validation/types lib, copied in from lib/api-zod.
      "@workspace/api-zod": path.resolve(root, "src/shared/api-zod/index.ts"),
      // Unused by source today, aliased so any stray reference still resolves.
      "@assets": path.resolve(root, "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5180,
    host: "0.0.0.0",
    // Proxy API calls to the Express backend when it's running. The admin /
    // rep dashboards need this to log in and load data.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
