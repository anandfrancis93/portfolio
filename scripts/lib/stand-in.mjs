// The deploy's guard for intent 004: a build that did not see CONTACT_EMAIL shows the stand-in
// address, and no deploy may publish it. The HTML is the check; the PDF comes from the same
// build and its text streams are compressed.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { STAND_IN } from "../../src/content/contact.ts";

/** The HTML files under distDir, as paths relative to it, that contain the stand-in. */
export function findStandIn(distDir) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".html") && readFileSync(path, "utf8").includes(STAND_IN)) {
        found.push(relative(distDir, path));
      }
    }
  };
  walk(distDir);
  return found.sort();
}
