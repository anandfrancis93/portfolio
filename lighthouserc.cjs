// Lighthouse CI, mobile (the default emulation): three runs of the home page on the preview,
// the median against the floors of spec section 10, gate 1, and the web-quality budgets for
// the two vitals Lighthouse measures in a lab (LCP under 2.0 s, CLS 0), as errors. Reports
// land in .lighthouseci/mobile. scripts/lighthouse.mjs starts the preview and runs this and
// the desktop variant.
const url = process.env.LIGHTHOUSE_URL ?? `http://127.0.0.1:${process.env.PREVIEW_PORT ?? "8788"}`;

const median = (rest) => ["error", { aggregationMethod: "median", ...rest }];
const floors = {
  "categories:performance": median({ minScore: 0.95 }),
  "categories:accessibility": median({ minScore: 1 }),
  "categories:best-practices": median({ minScore: 1 }),
  "categories:seo": median({ minScore: 1 }),
  "largest-contentful-paint": median({ maxNumericValue: 2000 }),
  "cumulative-layout-shift": median({ maxNumericValue: 0 }),
};

module.exports = {
  ci: {
    collect: {
      url: [`${url.replace(/\/$/, "")}/`],
      numberOfRuns: 3,
    },
    assert: { assertions: floors },
    upload: { target: "filesystem", outputDir: ".lighthouseci/mobile" },
  },
  floors,
};
