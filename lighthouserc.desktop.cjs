// Lighthouse CI, desktop preset: the same floors and runs as lighthouserc.cjs, reports in
// .lighthouseci/desktop.
const mobile = require("./lighthouserc.cjs");

module.exports = {
  ci: {
    collect: {
      ...mobile.ci.collect,
      settings: { preset: "desktop" },
    },
    assert: { assertions: mobile.floors },
    upload: { target: "filesystem", outputDir: ".lighthouseci/desktop" },
  },
};
