// The profile as Astro pages see it. Vite inlines the YAML at build time through the ?raw
// import, so this works in dev, in the prerender build and in preview without touching the
// file system, and it can never pull node:fs into a client bundle.
import raw from "./profile.yaml?raw";
import { loadProfile } from "./profile.ts";

export * from "./profile.ts";
export const profile = loadProfile(raw);
