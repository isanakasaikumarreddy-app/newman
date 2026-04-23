import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: '/newman/',
  server: {
    proxy: {
      "/api": {
        target: "https://api.toorakcapital.info",  // ← your real API URL
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});