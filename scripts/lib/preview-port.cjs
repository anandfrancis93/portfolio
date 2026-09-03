// The preview port, parsed once for every consumer: the preview script and server library
// (ESM), the Playwright config (TypeScript) and the Lighthouse config (CommonJS), so a blank,
// zero or out-of-range PREVIEW_PORT means the default everywhere rather than in one place.
// CommonJS because the Lighthouse config can only require.
const DEFAULT_PORT = 8788;

/** PREVIEW_PORT when it is a whole number between 1 and 65535, else the default. */
function previewPort(value = process.env.PREVIEW_PORT) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULT_PORT;
}

module.exports = { DEFAULT_PORT, previewPort };
