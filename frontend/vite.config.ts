import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:3200",
      "/report": "http://127.0.0.1:3200",
      "/playwright-report": "http://127.0.0.1:3200",
      "/platform-files": "http://127.0.0.1:3200"
    }
  },
  build: {
    outDir: path.resolve(__dirname, "../dist/platform-console"),
    emptyOutDir: true
  }
});
