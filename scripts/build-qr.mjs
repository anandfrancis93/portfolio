// Generates the résumé QR code as SVG from the URL in profile.yaml, or checks that the
// committed file is what the generator would produce. Deterministic: pinned library, fixed
// options, one input, so the committed bytes can be verified at every build.
//   node scripts/build-qr.mjs          write src/assets/qr-resume.svg
//   node scripts/build-qr.mjs --check  exit 1 if the file is missing or differs
// Error level M. Black modules on a white ground that is part of the file, with the standard
// four-module quiet zone, so the code scans the same on either theme.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { loadProfile } from "../src/content/profile.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "src/assets/qr-resume.svg");
const check = process.argv.includes("--check");

const profile = loadProfile(readFileSync(resolve(root, "src/content/profile.yaml"), "utf8"));
const url = new URL(profile.contact.resume.href, profile.identity.siteUrl).href;

const svg = await QRCode.toString(url, {
  type: "svg",
  errorCorrectionLevel: "M",
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
});
const expected = `${svg.trim()}\n`;

if (check) {
  const actual = existsSync(target) ? readFileSync(target, "utf8").replace(/\r\n/g, "\n") : null;
  if (actual !== expected) {
    console.error(
      `src/assets/qr-resume.svg is ${actual === null ? "missing" : "out of date"} for ${url}. Run: pnpm build:qr`,
    );
    process.exit(1);
  }
  console.log(`qr-resume.svg encodes ${url}.`);
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, expected, "utf8");
console.log(`Wrote ${target} for ${url}`);
