// Every text file git knows about, tracked or not yet staged, is LF in the index and in the
// working tree. .gitattributes forces it; this catches a file that slipped in as CRLF or mixed
// before it reaches CI, on the Windows machine as well as on Ubuntu. Binary files (attr -text,
// the fonts) have no line endings to check.
//   node scripts/check-eol.mjs
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listing = execFileSync(
  "git",
  ["ls-files", "--eol", "-z", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" },
);

const offenders = [];
let files = 0;
for (const entry of listing.split("\0").filter(Boolean)) {
  const [attrs, path] = entry.split("\t");
  const index = /\bi\/(\S*)/.exec(attrs)?.[1] ?? "";
  const worktree = /\bw\/(\S*)/.exec(attrs)?.[1] ?? "";
  if (index === "-text" || worktree === "-text") continue;
  files += 1;
  // "none": no line ending at all (an empty or one-line file), which cannot be CRLF.
  const badIndex = index !== "" && index !== "none" && index !== "lf";
  const badWorktree = worktree !== "" && worktree !== "none" && worktree !== "lf";
  if (badIndex || badWorktree) {
    offenders.push(`${path} (index ${index || "-"}, working tree ${worktree || "-"})`);
  }
}

if (offenders.length > 0) {
  console.error(`Line endings must be LF:\n  ${offenders.join("\n  ")}`);
  process.exit(1);
}
console.log(`Line endings: ${files} text files, all LF.`);
