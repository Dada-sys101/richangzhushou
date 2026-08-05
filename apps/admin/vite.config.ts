import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 1100,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        changeOrigin: true,
        target: "http://127.0.0.1:3000",
      },
    },
    strictPort: true,
  },
});
