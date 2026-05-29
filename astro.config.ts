import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare(),

  fonts: [
    // monospace
    {
      name: "Fira Mono",
      cssVariable: "--font-fira-mono",
      provider: fontProviders.fontsource(),
      weights: [400, 500, 600, 700],
      styles: ["normal", "italic"],
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
