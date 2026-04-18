// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://antonio-in-stem.github.io",
  base: "/static-bin",
  integrations: [svelte(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  build: {
    inlineStylesheets: "auto",
  },
});
