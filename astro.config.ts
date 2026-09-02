import { defineConfig } from "astro/config";

// Static site, no adapter. See docs/sdlc/001-portfolio-v1/plan.md, "Decisions taken in this plan".
export default defineConfig({
  site: "https://anandfrancis.com",
  output: "static",
  // The Astro 7 default is 'jsx', which strips whitespace between inline elements in prose.
  compressHTML: true,
  build: {
    // Keep every stylesheet external so the CSP can be style-src 'self'.
    inlineStylesheets: "never",
    assets: "_astro",
  },
  vite: {
    build: {
      // No data: URIs; every asset is a fingerprinted file the CSP can allow by origin.
      assetsInlineLimit: 0,
    },
  },
});
