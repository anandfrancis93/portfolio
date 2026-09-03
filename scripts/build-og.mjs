// Screenshots the built /og-card page into the social card, dist/og.png. The page is laid out
// at the card tokens in src/styles/tokens.site.css and rendered at the ratio between the image
// tokens and the card tokens (1.5x), so the type ramp is used as it is and the image is the
// size the networks expect and Base.astro declares.
//   node scripts/build-og.mjs   (after astro build)
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { serveDist } from "./lib/serve-dist.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const target = resolve(dist, "og.png");

const tokens = readFileSync(resolve(root, "src/styles/tokens.site.css"), "utf8");
const token = (name) => {
  const m = new RegExp(`${name}:\\s*(\\d+)px`).exec(tokens);
  if (!m) throw new Error(`${name} is not in tokens.site.css`);
  return Number(m[1]);
};
const card = { width: token("--size-og-card-width"), height: token("--size-og-card-height") };
const image = { width: token("--size-og-image-width"), height: token("--size-og-image-height") };
const scale = image.width / card.width;
if (image.height / card.height !== scale) {
  console.error("The og card and image tokens do not share one ratio.");
  process.exit(1);
}

if (!existsSync(resolve(dist, "og-card/index.html"))) {
  console.error("dist/og-card/index.html is missing: run astro build first.");
  process.exit(1);
}

const server = await serveDist(dist);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: card,
    deviceScaleFactor: scale,
    colorScheme: "light",
  });
  const page = await context.newPage();
  await page.goto(`${server.url}/og-card/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: target, type: "png", clip: { x: 0, y: 0, ...card } });
} finally {
  await browser.close();
  await server.close();
}

// The PNG header carries the pixel size; prove the card is what the meta tags promise.
const png = readFileSync(target);
const pixelWidth = png.readUInt32BE(16);
const pixelHeight = png.readUInt32BE(20);
if (pixelWidth !== image.width || pixelHeight !== image.height) {
  console.error(
    `dist/og.png is ${pixelWidth} by ${pixelHeight}; expected ${image.width} by ${image.height}.`,
  );
  process.exit(1);
}
console.log(
  `Wrote dist/og.png: ${pixelWidth} by ${pixelHeight}, ${Math.round(png.length / 1024)} KB.`,
);
