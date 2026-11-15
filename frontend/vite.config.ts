import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev-server proxy mirrors nginx so the SPA always calls same-origin /api/* (architecture.md §1).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
