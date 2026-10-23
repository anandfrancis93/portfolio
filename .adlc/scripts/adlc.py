#!/usr/bin/env python3
"""ADLC helper. Standard library only, so it runs in any repo and any CI.
Repos get a copy at .adlc/scripts/adlc.py from `sync`. Edit it only in the ADLC repo.

  adlc.py tier [--map FILE] [PATH ...]    print T1, T2 or T3 for the paths (stdin if none)
  adlc.py check-protected [--list FILE]   Claude Code PreToolUse hook: block edits to protected paths
  adlc.py protected-changes --base SHA --head SHA [--list FILE]
                                          CI: fail if a PR commit edits a path its parent commit protects
  adlc.py review-rounds --reviewers A,B   count review rounds in `gh api .../reviews` JSON on stdin
  adlc.py t3-approved --owner LOGIN --head SHA --since TIME --reviews FILE --events FILE
                                          CI: pass if the owner approved commit SHA, or added the
                                          adlc:t3-approved label last and after TIME (`gh api` JSON)
  adlc.py pr-title TITLE                  check a PR title against Conventional Commits 1.0.0
  adlc.py changelog-draft --current X.Y.Z --repo OWNER/NAME
                                          next SemVer version and a Common Changelog draft from
                                          `git log --format='%h%x1f%s%x1f%b%x1e' vX.Y.Z..HEAD` on stdin
  adlc.py changelog-entry VERSION [--file CHANGELOG.md]
                                          print one release's entry (for release notes); fail if missing
  adlc.py sync TARGET [--releases] [--check]
                                          from an ADLC checkout at a release tag: write the ADLC's files
                                          into the repo at TARGET (see docs/sync.md)
  adlc.py manifest [--write | --check]    in the ADLC repo: the hashes the drift step in adlc.yml compares
  adlc.py sync-repos --owner OWNER [--skip OWNER/NAME] [--dry-run]
                                          from an ADLC checkout at a release tag: open a sync PR in each
                                          of OWNER's repos on an older release (needs GH_TOKEN)
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

TIERS = ("T1", "T2", "T3")
DEFAULT_TIER = "T2"


def glob_to_regex(pattern):
    """Translate a path glob to a regex. `**` crosses directories, `*` and `?` do not."""
    i, out = 0, []
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif c == "*":
            out.append("[^/]*")
            i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(c))
            i += 1
    return re.compile("^" + "".join(out) + "$")


def parse_rules(lines, source):
    """Return [(tier_or_None, regex)] from the lines of a rules file."""
    rules = []
    for n, raw in enumerate(lines, 1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        if parts[0] in TIERS:
            if len(parts) != 2:
                sys.exit(f"{source}:{n}: expected '<tier> <glob>', got: {raw.strip()}")
            rules.append((parts[0], glob_to_regex(parts[1])))
        elif len(parts) == 1:
            rules.append((None, glob_to_regex(parts[0])))
        else:
            sys.exit(f"{source}:{n}: unknown tier {parts[0]!r}")
    return rules


def read_rules(path):
    """Return [(tier_or_None, regex)] from a rules file; a missing file means no rules."""
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return parse_rules(f, path)


def normalize(path):
    path = path.strip()
    while path.startswith("./"):
        path = path[2:]
    return path


def tier_of(path, rules):
    hits = [t for t, rx in rules if rx.match(path)]
    return max(hits) if hits else DEFAULT_TIER


def cmd_tier(args):
    rules = read_rules(args.map)
    paths = args.paths or [line for line in sys.stdin.read().splitlines()]
    paths = [normalize(p) for p in paths if p.strip()]
    if not paths:
        print("T1")
        return 0
    result = "T1"
    for p in paths:
        t = tier_of(p, rules)
        if args.explain:
            print(f"{t} {p}", file=sys.stderr)
        result = max(result, t)
    print(result)
    return 0


def cmd_check_protected(args):
    project = os.environ.get("CLAUDE_PROJECT_DIR")
    rules = read_rules(os.path.join(project, args.list) if project and not os.path.isabs(args.list) else args.list)
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    tool_input = event.get("tool_input") or {}
    target = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not target:
        return 0
    root = os.environ.get("CLAUDE_PROJECT_DIR") or event.get("cwd") or os.getcwd()
    cwd = event.get("cwd") or root
    rel = os.path.relpath(os.path.abspath(os.path.join(cwd, target)), root)
    for _, rx in rules:
        if rx.match(rel):
            print(
                f"ADLC: {rel} is protected (listed in {args.list}). "
                "Ask the owner if the list is wrong.",
                file=sys.stderr,
            )
            return 2
    return 0


def git(*args):
    p = subprocess.run(["git", *args], capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f"adlc.py: git {' '.join(args)} failed: {p.stderr.strip()}")
    return p.stdout


def protected_at(commit, path):
    """The protected list as it was at a commit: (set of its lines, rules). Empty if the file was absent."""
    p = subprocess.run(["git", "show", f"{commit}:{path}"], capture_output=True, text=True)
    lines = p.stdout.splitlines() if p.returncode == 0 else []
    entries = {line.split("#", 1)[0].strip() for line in lines} - {""}
    return entries, parse_rules(lines, f"{commit}:{path}")


EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"


def is_ancestor(a, b):
    return subprocess.run(["git", "merge-base", "--is-ancestor", a, b], capture_output=True).returncode == 0


def cmd_protected_changes(args):
    """Check each PR commit against the list in its first parent, so a failing test protected by an
    earlier commit of the same PR is covered. Once a commit removes a line, it and every later commit
    may change only the list, so a PR cannot unprotect a test and then edit it.
    A merge counts as one commit. A merge of the base branch counts only its hand edits, and lines
    the base removed, because the base was checked on its own.
    Limit: a branch squashed or force-pushed before CI hides the commit order."""
    commits = git("rev-list", "--reverse", "--first-parent", f"{args.base}..{args.head}").split()
    problems, removed_in = [], None
    for c in commits:
        first, *others = git("rev-list", "--parents", "-n", "1", c).split()[1:] or [EMPTY_TREE]
        before, rules = protected_at(first, args.list)
        after, _ = protected_at(c, args.list)
        if others and all(is_ancestor(p, args.base) for p in others):
            diff = git("diff-tree", "-c", "-r", "--no-commit-id", "--name-only", "-z", c)
            for p in others:
                mb = git("merge-base", first, p).strip()
                before -= protected_at(mb, args.list)[0] - protected_at(p, args.list)[0]
        else:
            diff = git("diff-tree", "--no-commit-id", "--name-only", "-r", "-z", first, c)
        files = [f for f in diff.split("\0") if f]
        for f in files:
            if any(rx.match(f) for _, rx in rules):
                problems.append(f"{c[:7]} edits {f}, which {args.list} lists.")
        if before - after and not removed_in:
            removed_in = c[:7]
        others = [f for f in files if f != args.list]
        if removed_in and others:
            problems.append(
                f"{c[:7]} changes {', '.join(others)} after {removed_in} removed lines from {args.list}. "
                "Remove lines only at the end of a PR, in commits that change nothing else."
            )
    for problem in problems:
        print(f"ADLC: {problem}", file=sys.stderr)
    if problems:
        print("ADLC: a fix must not change its failing test. Ask the owner if the list is wrong.", file=sys.stderr)
        return 1
    return 0


def cmd_review_rounds(args):
    """A round is one submitted review by a listed reviewer. COMMENTED, CHANGES_REQUESTED
    and APPROVED all count; PENDING and DISMISSED do not."""
    reviewers = {r.strip().lower() for r in args.reviewers.split(",") if r.strip()}
    reviews = json.load(sys.stdin)
    rounds = sum(
        1
        for r in reviews
        if (r.get("user") or {}).get("login", "").lower() in reviewers
        and r.get("state") in ("COMMENTED", "CHANGES_REQUESTED", "APPROVED")
    )
    print(rounds)
    return 0


# Conventional Commits 1.0.0 header: type, optional (scope), optional !, colon, space, description.
T3_LABEL = "adlc:t3-approved"


def utc(stamp):
    return datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00")) if stamp else None


def t3_approval(owner, head, since, reviews, events):
    """How the owner approved the PR at commit head, or None. The label counts only when the owner
    added it last, after since: the time commit head reached GitHub."""
    owner = owner.strip().lower()
    if not owner:
        return None
    for r in reviews:
        if (r.get("user") or {}).get("login", "").lower() == owner and r.get("state") == "APPROVED" \
                and r.get("commit_id") == head:
            return f"{owner} approved commit {head}"
    last = None
    for e in sorted(events, key=lambda e: (e.get("created_at") or "", e.get("id") or 0)):
        if e.get("event") in ("labeled", "unlabeled") and (e.get("label") or {}).get("name") == T3_LABEL:
            last = e
    if last and last["event"] == "labeled" and (last.get("actor") or {}).get("login", "").lower() == owner \
            and since and last.get("created_at") and utc(last["created_at"]) > utc(since):
        return f"{owner} added the {T3_LABEL} label after commit {head}"
    return None


def cmd_t3_approved(args):
    with open(args.reviews, encoding="utf-8") as f:
        reviews = json.load(f) or []
    with open(args.events, encoding="utf-8") as f:
        events = json.load(f) or []
    how = t3_approval(args.owner, args.head, args.since, reviews, events)
    if not how:
        print(f"T3 change: needs the {T3_LABEL} label from {args.owner or 'ADLC_OWNER (not set)'} after "
              f"commit {args.head}, or an approval of that commit.", file=sys.stderr)
        return 1
    print(f"T3 approved: {how}.")
    return 0


TITLE_RE = re.compile(r"^(?P<type>[A-Za-z]+)(?:\((?P<scope>[^()]+)\))?(?P<bang>!)?: (?P<desc>\S.*)$")
# feat and fix come from the spec; the rest are the commitlint config-conventional types it cites.
TYPES = ("feat", "fix", "build", "chore", "ci", "docs", "perf", "refactor", "revert", "style", "test")
BREAKING_FOOTER = re.compile(r"^BREAKING[ -]CHANGE: ", re.M)
SEMVER_RE = re.compile(r"^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
PR_REF = re.compile(r" \(#(\d+)\)$")
# Common Changelog categories, in its order. Types not listed here are maintenance noise.
GROUP_OF = {"feat": "Added", "fix": "Fixed", "perf": "Changed", "refactor": "Changed", "revert": "Changed"}
GROUPS = ("Changed", "Added", "Removed", "Fixed")


def parse_title(title):
    """Return (type, breaking, description) or None if not a Conventional Commits header."""
    m = TITLE_RE.match(title.strip())
    if not m or m.group("type").lower() not in TYPES:
        return None
    return m.group("type").lower(), bool(m.group("bang")), m.group("desc")


def cmd_pr_title(args):
    if parse_title(args.title):
        return 0
    print(
        f"ADLC: PR title {args.title!r} is not a Conventional Commit. Use '<type>[(scope)][!]: <description>' "
        f"with type one of {', '.join(TYPES)}. Example: 'fix(api): reject empty names'.",
        file=sys.stderr,
    )
    return 1


def cmd_changelog_draft(args):
    m = SEMVER_RE.match(args.current)
    if not m:
        sys.exit(f"adlc.py: --current {args.current!r} is not MAJOR.MINOR.PATCH")
    major, minor, patch = (int(x) for x in m.groups())
    url = f"https://github.com/{args.repo}"
    groups = {g: [] for g in GROUPS}
    left_out, bump = [], None
    for record in sys.stdin.read().split("\x1e"):
        fields = record.strip("\n").split("\x1f")
        if len(fields) < 2 or not fields[0].strip():
            continue
        sha, subject, body = fields[0].strip(), fields[1].strip(), (fields[2] if len(fields) > 2 else "")
        pr = PR_REF.search(subject)
        if pr:
            subject = subject[: pr.start()]
        parsed = parse_title(subject)
        if not parsed:
            left_out.append(f"{sha} {subject} (not a Conventional Commit)")
            continue
        type_, breaking, desc = parsed
        breaking = breaking or bool(BREAKING_FOOTER.search(body))
        group = "Changed" if breaking else GROUP_OF.get(type_)
        if not group:
            left_out.append(f"{sha} {subject}")
            continue
        refs = f"([`{sha}`]({url}/commit/{sha}))"
        if pr:
            refs += f" ([#{pr.group(1)}]({url}/pull/{pr.group(1)}))"
        text = desc[0].upper() + desc[1:]
        line = f"- **Breaking:** {desc[0].lower() + desc[1:]} {refs}" if breaking else f"- {text} {refs}"
        groups[group].append((not breaking, line))
        level = 3 if breaking else 2 if type_ == "feat" else 1
        bump = max(bump or 0, level)
    if not bump:
        print("No user-facing changes since the last release; no new version.", file=sys.stderr)
        return 3
    if major == 0 and bump == 3:
        bump = 2  # SemVer item 4: in 0.y.z anything may change, so breaking bumps MINOR.
    version = {3: f"{major + 1}.0.0", 2: f"{major}.{minor + 1}.0", 1: f"{major}.{minor}.{patch + 1}"}[bump]
    date = args.date or datetime.date.today().isoformat()
    out = [f"## [{version}] - {date}", ""]
    for g in GROUPS:
        if groups[g]:
            # Breaking changes first; otherwise keep git log order, which is latest-first.
            out += [f"### {g}", "", *(line for _, line in sorted(groups[g], key=lambda x: x[0])), ""]
    out.append(f"[{version}]: {url}/releases/tag/v{version}")
    if left_out:
        out += ["", "<!-- Left out as maintenance. Add back anything a user of the release would notice:"]
        out += [f"  {x}" for x in left_out] + ["-->"]
    print("\n".join(out))
    return 0


ENTRY_RE = re.compile(r"^## \[?(\d+\.\d+\.\d+)\]? - \d{4}-\d{2}-\d{2}")


def changelog_entries(path):
    """{version: text} for each '## [X.Y.Z] - YYYY-MM-DD' entry, without its heading or link lines."""
    entries, current = {}, None
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("## ") or re.match(r"^\[[^\]]+\]: ", line):
                m = ENTRY_RE.match(line)
                current = m.group(1) if m and m.group(1) not in entries else None
                if current:
                    entries[current] = []
                continue
            if current:
                entries[current].append(line.rstrip("\n"))
    return {version: "\n".join(lines).strip() for version, lines in entries.items()}


def cmd_changelog_entry(args):
    version = args.version[1:] if args.version.startswith("v") else args.version
    entries = changelog_entries(args.file)
    if version not in entries:
        print(f"ADLC: {args.file} has no '## {version} - YYYY-MM-DD' entry. Write it before tagging.", file=sys.stderr)
        return 1
    print(entries[version])
    return 0


# Files `sync` writes into a repo, as (path in the repo, source in the ADLC repo).
# Managed files belong to the ADLC: every sync overwrites them, and the drift step in adlc.yml
# fails a PR whose copy differs from the pinned release. A source of None is the version record.
MANAGED = (
    (".adlc/version", None),
    (".adlc/scripts/adlc.py", "scripts/adlc.py"),
    (".githooks/pre-commit", "templates/git-hooks/pre-commit"),
    (".github/workflows/adlc.yml", "templates/github/workflows/adlc.yml"),
    (".github/workflows/adlc-review.yml", "templates/github/workflows/adlc-review.yml"),
    (".github/workflows/adlc-pr-title.yml", "templates/github/workflows/adlc-pr-title.yml"),
    (".github/workflows/adlc-dependabot.yml", "templates/github/workflows/adlc-dependabot.yml"),
    (".github/pull_request_template.md", "templates/pull_request_template.md"),
)
# Managed only in repos that ship releases: sync --releases adds it, and later syncs keep it.
MANAGED_RELEASES = ((".github/workflows/adlc-release.yml", "templates/github/workflows/adlc-release.yml"),)
# Repo-owned files start from a template. Sync adds them only when missing and never checks them.
SEEDS = (
    ("AGENTS.md", "templates/AGENTS.md"),
    ("REVIEW.md", "templates/REVIEW.md"),
    (".adlc/tiers", "templates/adlc/tiers"),
    (".adlc/protected", "templates/adlc/protected"),
    (".adlc/install", "templates/adlc/install"),
    (".adlc/fast-check", "templates/adlc/fast-check"),
    (".adlc/full-test", "templates/adlc/full-test"),
    (".adlc/retire-log.md", "templates/adlc/retire-log.md"),
    (".editorconfig", "templates/editorconfig"),
    (".github/dependabot.yml", "templates/github/dependabot.yml"),
)
SEEDS_RELEASES = (("CHANGELOG.md", "templates/CHANGELOG.md"),)
VERSION_TOKEN = b"{{ADLC_VERSION}}"
DRIFT_WORKFLOW = ".github/workflows/adlc.yml"
MANIFEST_BEGIN = "# BEGIN manifest"
MANIFEST_END = "# END manifest"


def adlc_root():
    """The ADLC checkout this script is in. A repo's .adlc/scripts copy has no templates to sync."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not os.path.isfile(os.path.join(root, ".claude-plugin", "plugin.json")):
        sys.exit("adlc.py: run this with scripts/adlc.py in an ADLC checkout, not a repo's .adlc/scripts copy.")
    return root


def adlc_version(root):
    with open(os.path.join(root, ".claude-plugin", "plugin.json"), encoding="utf-8") as f:
        return json.load(f)["version"]


def render(root, source, version):
    """The bytes and executable bit `sync` writes for a source. Templates get the version filled in."""
    if source is None:
        return f"{version}\n".encode(), False
    path = os.path.join(root, source)
    with open(path, "rb") as f:
        data = f.read()
    if source.startswith("templates/"):
        data = data.replace(VERSION_TOKEN, version.encode())
    return data, bool(os.stat(path).st_mode & 0o100)


def manifest_lines(root, version):
    """The shell lines between the markers in the drift step: version and `sha256 path [optional]` rows."""
    rows = [(p, s, "") for p, s in MANAGED] + [(p, s, " optional") for p, s in MANAGED_RELEASES]
    lines = [f"version={version}", "manifest='"]
    for path, source, flag in rows:
        lines.append(f"{hashlib.sha256(render(root, source, version)[0]).hexdigest()} {path}{flag}")
    return lines + ["'"]


def cmd_manifest(args):
    root = adlc_root()
    lines = manifest_lines(root, adlc_version(root))
    if not (args.write or args.check):
        print("\n".join(lines))
        return 0
    path = os.path.join(root, DRIFT_WORKFLOW)
    with open(path, encoding="utf-8") as f:
        text = f.read().split("\n")
    begin = next((i for i, line in enumerate(text) if line.strip().startswith(MANIFEST_BEGIN)), None)
    end = next((i for i, line in enumerate(text) if line.strip().startswith(MANIFEST_END)), None)
    if begin is None or end is None or end < begin:
        sys.exit(f"adlc.py: {DRIFT_WORKFLOW} has no '{MANIFEST_BEGIN}' ... '{MANIFEST_END}' block.")
    indent = text[begin][: len(text[begin]) - len(text[begin].lstrip())]
    new = [indent + line for line in lines]
    if text[begin + 1 : end] == new:
        return 0
    if args.check:
        print(f"ADLC: the manifest in {DRIFT_WORKFLOW} is out of date. Run: python3 scripts/adlc.py manifest --write",
              file=sys.stderr)
        return 1
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(text[: begin + 1] + new + text[end:]))
    return 0


def check_release_checkout(root, version):
    """Refuse a git checkout that is not exactly at tag vVERSION, so a repo never gets unreleased files."""
    top = subprocess.run(["git", "-C", root, "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if top.returncode != 0 or os.path.realpath(top.stdout.strip()) != os.path.realpath(root):
        return
    tag = subprocess.run(["git", "-C", root, "describe", "--exact-match", "--tags", "HEAD"],
                         capture_output=True, text=True).stdout.strip()
    dirty = subprocess.run(["git", "-C", root, "status", "--porcelain", "--untracked-files=no"],
                           capture_output=True, text=True).stdout.strip()
    if tag != f"v{version}" or dirty:
        sys.exit(f"adlc.py: {root} is not a clean checkout of release tag v{version}. "
                 "Sync from a release: git checkout vX.Y.Z (see docs/sync.md).")


def sync_files(root, version, target, releases, check):
    """Write the release's files into target. Returns (version before, changes such as 'add PATH')."""
    releases = releases or os.path.exists(os.path.join(target, MANAGED_RELEASES[0][0]))
    managed = MANAGED + (MANAGED_RELEASES if releases else ())
    seeds = SEEDS + (SEEDS_RELEASES if releases else ())
    before = "none"
    if os.path.isfile(os.path.join(target, ".adlc", "version")):
        with open(os.path.join(target, ".adlc", "version"), encoding="utf-8") as f:
            before = f.read().strip()
    changes = []
    for (path, source), owned in [(m, False) for m in managed] + [(s, True) for s in seeds]:
        dest = os.path.join(target, path)
        exists = os.path.isfile(dest)
        if owned and exists:
            continue
        data, executable = render(root, source, version)
        if exists:
            with open(dest, "rb") as f:
                same = f.read() == data
            if same and bool(os.stat(dest).st_mode & 0o100) == executable:
                continue
        changes.append(f"{'update' if exists else 'add'} {path}")
        if check:
            continue
        os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
        with open(dest, "wb") as f:
            f.write(data)
        os.chmod(dest, 0o755 if executable else 0o644)
    return before, changes


def cmd_sync(args):
    root = adlc_root()
    version = adlc_version(root)
    check_release_checkout(root, version)
    target = os.path.abspath(args.target)
    if not os.path.isdir(target):
        sys.exit(f"adlc.py: {target} is not a directory.")
    before, changes = sync_files(root, version, target, args.releases, args.check)
    for change in changes:
        print(("would " if args.check else "") + change)
    if args.check:
        return 1 if changes else 0
    if os.path.exists(os.path.join(target, ".git")):
        hooks = subprocess.run(["git", "-C", target, "config", "core.hooksPath", ".githooks"], capture_output=True)
        if hooks.returncode != 0:
            print("ADLC: could not set core.hooksPath; run: git config core.hooksPath .githooks", file=sys.stderr)
    print(f"ADLC {before} -> {version}: {len(changes)} file(s) changed.", file=sys.stderr)
    return 0


def gh(*args):
    """Run the GitHub CLI, which reads GH_TOKEN. Returns (exit code, stdout, stderr)."""
    p = subprocess.run(["gh", *args], capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def git_env():
    """Environment for git that sends GH_TOKEN to github.com the way actions/checkout does,
    so the token never appears in a URL or on a command line."""
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    n = int(env.get("GIT_CONFIG_COUNT", "0"))
    auth = base64.b64encode(f"x-access-token:{env['GH_TOKEN']}".encode()).decode()
    env[f"GIT_CONFIG_KEY_{n}"] = "http.https://github.com/.extraheader"
    env[f"GIT_CONFIG_VALUE_{n}"] = f"AUTHORIZATION: basic {auth}"
    env["GIT_CONFIG_COUNT"] = str(n + 1)
    return env


def run_git(env, *args):
    p = subprocess.run(["git", *args], env=env, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"git {args[0] if args[0] != '-C' else args[2]} failed: {p.stderr.strip()}")


def read_repo_file(repo, path):
    """A file's text on the repo's default branch, or None if it is missing."""
    code, out, err = gh("api", f"repos/{repo}/contents/{path}", "-H", "Accept: application/vnd.github.raw")
    if code == 0:
        return out
    if "HTTP 404" in err:
        return None
    raise RuntimeError(f"could not read {path}: {err.strip()}")


def semver(text):
    m = SEMVER_RE.match(text.strip())
    return tuple(int(n) for n in m.groups()) if m else None


def sync_pr_body(root, before, version, changes):
    path = os.path.join(root, "CHANGELOG.md")
    entries = changelog_entries(path) if os.path.isfile(path) else {}
    old, new = semver(before) or (0, 0, 0), semver(version)
    shown = sorted((v for v in entries if semver(v) and old < semver(v) <= new), key=semver, reverse=True)
    lines = [f"Syncs this repo from ADLC {before} to {version}. The ADLC release workflow opened this PR.", ""]
    if any("**Breaking:**" in entries[v] for v in shown):
        lines += ["Before merging, do what each **Breaking** line below asks, in this PR.", ""]
    lines += ["Files `adlc.py sync` changed:", ""] + [f"- {c}" for c in changes] + [""]
    for v in shown:
        lines += [f"## ADLC {v}", "", entries[v], ""]
    return "\n".join(lines)


def sync_repo(root, version, repo, base, dry_run):
    """Open a sync PR in one repo if it is on an older release. Returns its report line,
    or None for a repo that does not use the ADLC. Raises RuntimeError when a step fails."""
    recorded = read_repo_file(repo, ".adlc/version")
    if recorded is None:
        if read_repo_file(repo, ".adlc/tiers") is None:
            return None
        return "not synced yet: sync it once by hand (docs/sync.md)"
    current = recorded.strip()
    if semver(current) is None:
        raise RuntimeError(f".adlc/version is {current!r}, not X.Y.Z")
    if semver(current) >= semver(version):
        return f"on {current}"
    branch = f"adlc/sync-{version}"
    code, out, err = gh("pr", "list", "-R", repo, "--head", branch, "--state", "open", "--json", "url")
    if code != 0:
        raise RuntimeError(f"could not list PRs: {err.strip()}")
    if json.loads(out):
        return f"on {current}; sync PR already open: {json.loads(out)[0]['url']}"
    if dry_run:
        return f"on {current}; would open a PR to sync to {version}"
    env = git_env()
    with tempfile.TemporaryDirectory() as tmp:
        work = os.path.join(tmp, "repo")
        run_git(env, "clone", "-q", "--depth", "1", f"https://github.com/{repo}", work)
        run_git(env, "-C", work, "checkout", "-q", "-b", branch)
        before, changes = sync_files(root, version, work, False, False)
        run_git(env, "-C", work, "add", "-A")
        run_git(env, "-C", work, "-c", "user.name=github-actions[bot]", "-c",
                "user.email=41898282+github-actions[bot]@users.noreply.github.com", "-c", "commit.gpgsign=false",
                "commit", "-q", "-m", f"chore(adlc): sync to {version}")
        run_git(env, "-C", work, "push", "-q", "--force", "origin", branch)
        body = os.path.join(tmp, "body.md")
        with open(body, "w", encoding="utf-8") as f:
            f.write(sync_pr_body(root, before, version, changes))
        create = ["pr", "create", "-R", repo, "--head", branch, "--title", f"chore(adlc): sync to {version}",
                  "--body-file", body] + (["--base", base] if base else [])
        code, out, err = gh(*create)
        if code != 0:
            raise RuntimeError(f"could not open the PR: {err.strip()}")
    return f"on {current}; opened {out.strip()}"


def cmd_sync_repos(args):
    root = adlc_root()
    version = adlc_version(root)
    check_release_checkout(root, version)
    if not os.environ.get("GH_TOKEN"):
        sys.exit("adlc.py: set GH_TOKEN to a token that can open PRs in the owner's repos (docs/sync.md).")
    code, out, err = gh("repo", "list", args.owner, "--no-archived", "--source", "--limit", "1000",
                        "--json", "nameWithOwner,defaultBranchRef")
    if code != 0:
        sys.exit(f"adlc.py: could not list {args.owner}'s repos: {err.strip()}")
    skip = {name.lower() for name in args.skip}
    lines, failed = [], 0
    for r in sorted(json.loads(out), key=lambda r: r["nameWithOwner"].lower()):
        repo = r["nameWithOwner"]
        if repo.lower() in skip:
            continue
        try:
            line = sync_repo(root, version, repo, (r.get("defaultBranchRef") or {}).get("name"), args.dry_run)
        except (RuntimeError, ValueError, OSError) as e:
            line, failed = f"failed: {e}", failed + 1
        if line:
            lines.append(f"- {repo}: {line}")
    report = "\n".join([f"ADLC {version}: repos that use the ADLC", ""] + (lines or ["- none"]))
    print(report)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(report + "\n")
    return 1 if failed else 0


def main():
    p = argparse.ArgumentParser(prog="adlc.py")
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("tier")
    t.add_argument("--map", default=".adlc/tiers")
    t.add_argument("--explain", action="store_true")
    t.add_argument("paths", nargs="*")
    c = sub.add_parser("check-protected")
    c.add_argument("--list", default=".adlc/protected")
    pc = sub.add_parser("protected-changes")
    pc.add_argument("--base", required=True)
    pc.add_argument("--head", required=True)
    pc.add_argument("--list", default=".adlc/protected")
    r = sub.add_parser("review-rounds")
    r.add_argument("--reviewers", required=True)
    ta = sub.add_parser("t3-approved")
    ta.add_argument("--owner", required=True)
    ta.add_argument("--head", required=True)
    ta.add_argument("--since", default="")
    ta.add_argument("--reviews", required=True)
    ta.add_argument("--events", required=True)
    pt = sub.add_parser("pr-title")
    pt.add_argument("title")
    cd = sub.add_parser("changelog-draft")
    cd.add_argument("--current", required=True)
    cd.add_argument("--repo", required=True)
    cd.add_argument("--date")
    ce = sub.add_parser("changelog-entry")
    ce.add_argument("version")
    ce.add_argument("--file", default="CHANGELOG.md")
    sy = sub.add_parser("sync")
    sy.add_argument("target")
    sy.add_argument("--releases", action="store_true")
    sy.add_argument("--check", action="store_true")
    m = sub.add_parser("manifest")
    mode = m.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    sr = sub.add_parser("sync-repos")
    sr.add_argument("--owner", required=True)
    sr.add_argument("--skip", action="append", default=[])
    sr.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    return {
        "tier": cmd_tier,
        "check-protected": cmd_check_protected,
        "protected-changes": cmd_protected_changes,
        "review-rounds": cmd_review_rounds,
        "t3-approved": cmd_t3_approved,
        "pr-title": cmd_pr_title,
        "changelog-draft": cmd_changelog_draft,
        "changelog-entry": cmd_changelog_entry,
        "sync": cmd_sync,
        "manifest": cmd_manifest,
        "sync-repos": cmd_sync_repos,
    }[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
