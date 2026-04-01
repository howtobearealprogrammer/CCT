import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3002,
    proxy: {
      "/api/prometheus": {
        target: "http://localhost:9090",
        rewrite: (path) => path.replace(/^\/api\/prometheus/, ""),
      },
      "/api/loki": {
        target: "http://localhost:3100",
        rewrite: (path) => path.replace(/^\/api\/loki/, ""),
      },
    },
  },
});
