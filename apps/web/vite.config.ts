import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      injectRegister: "auto",
      manifest: {
        name: "Daily Assistant",
        short_name: "Daily",
        description: "Daily Assistant 用户端",
        display: "standalone",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
        start_url: "/",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
      },
      registerType: "prompt",
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
