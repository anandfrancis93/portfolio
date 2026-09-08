// The credential-use check (spec 003, section 2; the runbook, "The watch"): everything
// scripts/check-credential-use.mjs decides and prints, kept pure so the configuration tests can
// feed it fixtures. The judgement runs in the spec's order, actor first, then the deploy step's
// window, then the shape of writes that step makes; the report is built from an allow-list of
// fields through one escape function, so nothing the audit log carries about a person, and no
// text a deployer chose, reaches the public issue or the run log unescaped; and the state read
// takes the ids a previous report named from the fixed places the report's layout gives them.

/** The two deploy tokens, by the names spec 002 section 3.1 records. */
export const EXPECTED_TOKENS = new Set([
  "anandfrancis.com preview deploy (GitHub Actions)",
  "anandfrancis.com production deploy (GitHub Actions)",
]);

export const WORKERS = { preview: "anandfrancis-com-preview", production: "anandfrancis-com" };

/** The six writes a preview deploy makes, in the order the log shows them (spec preamble). */
export const DEPLOY_KINDS = [
  "Create Assets Upload Session",
  "Upload Assets",
  "Upload Version",
  "Create Deployment",
  "Patch Script Settings",
  "Post Worker subdomain",
];

/**
 * The production deploy's one extra write, assumed until the first real release measures it
 * (spec section 8, plan decision 8): the production Worker is bound to a custom domain in
 * wrangler.jsonc, which wrangler attaches through the account's Worker domains, not a zone
 * route, so any entry whose resource type names a domain or a route is the one extra kind.
 */
export const ROUTE_KIND = "route or domain";
const ROUTE_TYPE = /route|domain/i;

/**
 * What each deploy or rollback step is allowed to write, keyed by the step's name and its job's:
 * the Worker it touches and the kinds it makes, each at most once (spec 2.3).
 */
export const SHAPES = {
  deploy: {
    preview: { worker: WORKERS.preview, kinds: DEPLOY_KINDS },
    production: { worker: WORKERS.production, kinds: [...DEPLOY_KINDS, ROUTE_KIND] },
  },
  "roll back": {
    rollback: { worker: WORKERS.production, kinds: ["Create Deployment"] },
    "rollback-preview": { worker: WORKERS.preview, kinds: ["Create Deployment"] },
  },
};

export const INTERVAL_MS = 75 * 60_000;
export const PADDING_MS = 60_000;
/** The longest job timeout in deploy.yml: the furthest a step can start before its run's start. */
export const TIMEOUT_MS = 20 * 60_000;
export const CAP = 40;
export const FINDING_TITLE = "A credential was used outside the workflows";

const ms = (text) => {
  const at = Date.parse(String(text ?? ""));
  return Number.isNaN(at) ? null : at;
};

/**
 * The span a run reads. `since` is the earlier of the interval before now and a point safely
 * before the previous successful credential-use job's start: that job's own `before` stopped
 * at a running deploy step's start when there was one, and a step starts at most the timeout
 * before its job, so reaching back the timeout and the padding from the previous start covers
 * whatever it left waiting, and the state read absorbs the re-read (spec 2.2, 2.5). `before` is
 * now, or a running deploy step's start less the padding, so a deploy in flight waits for the
 * run that will have its finished window.
 */
export function span({ now, previousJobStartedAt = null, runningStepStartedAt = null }) {
  const at = ms(now);
  let since = at - INTERVAL_MS;
  const previous = ms(previousJobStartedAt);
  if (previous !== null && previous - TIMEOUT_MS - PADDING_MS < since) {
    since = previous - TIMEOUT_MS - PADDING_MS;
  }
  let before = at;
  const running = ms(runningStepStartedAt);
  if (running !== null && running - PADDING_MS < before) before = running - PADDING_MS;
  return { since: new Date(since).toISOString(), before: new Date(before).toISOString() };
}

/**
 * The windows the deploy workflow's steps made, from its runs and their jobs (GitHub's jobs
 * API, `filter=all`, steps inline, so a re-run's every attempt is its own job): a window belongs
 * to a step named `deploy` or `roll back` in a job the shapes know, and exists only when that
 * step ran and succeeded (spec 2.3). A step still running is returned apart, since the span
 * stops before it; a step that was skipped, never reached, or failed gives nothing, which is
 * the point. A job's name is looked up as an own property, so a job named `constructor` finds
 * no shape.
 */
export function windows(jobsByRun) {
  const made = [];
  const running = [];
  for (const [runId, jobs] of Object.entries(jobsByRun)) {
    for (const job of jobs ?? []) {
      for (const [stepName, byJob] of Object.entries(SHAPES)) {
        if (!Object.hasOwn(byJob, String(job?.name))) continue;
        const shape = byJob[job.name];
        for (const step of job.steps ?? []) {
          if (step.name !== stepName) continue;
          const start = ms(step.started_at);
          if (start === null) continue;
          if (step.status !== "completed") {
            running.push({ runId, job: job.name, step: stepName, startedAt: step.started_at });
            continue;
          }
          if (step.conclusion !== "success") continue;
          const end = ms(step.completed_at);
          if (end === null) continue;
          made.push({
            runId,
            jobId: job.id ?? null,
            job: job.name,
            step: stepName,
            worker: shape.worker,
            kinds: shape.kinds,
            start: start - PADDING_MS,
            end: end + PADDING_MS,
          });
        }
      }
    }
  }
  return { windows: made, running };
}

/** The token's name, from the nested shape the log returns or the flat one the schema names. */
export const tokenName = (actor) => actor?.token?.name ?? actor?.token_name ?? null;

/** The Worker a request touched: the first path segment after `/workers/scripts/`, or null. */
export const workerOf = (uri) => {
  const path = String(uri ?? "").split(/[?#]/)[0];
  const m = /\/workers\/scripts\/([^/]+)/.exec(path);
  return m ? m[1] : null;
};

const isExpectedActor = (actor) =>
  actor?.type === "delegated_service" ||
  (actor?.context === "api_token" && EXPECTED_TOKENS.has(tokenName(actor)));

const kindOf = (entry) => {
  const description = entry?.action?.description;
  if (DEPLOY_KINDS.includes(description)) return description;
  if (ROUTE_TYPE.test(String(entry?.resource?.type ?? ""))) return ROUTE_KIND;
  return description ?? null;
};

/**
 * The deployment and version ids an audit entry carries, when it does: the deployment's from
 * `resource.response.id` and the version's from `resource.request.versions[0].version_id` on
 * a `Create Deployment`, the version's from `resource.response.id` on an `Upload Version`. The
 * only two paths under `resource.request` and `resource.response` the formatter has, and the
 * same two ids the Workers' lists print (spec 2.4 as corrected; plan decision 7).
 */
export function idsOf(entry) {
  const request = entry?.resource?.request ?? {};
  const response = entry?.resource?.response ?? {};
  const type = String(entry?.resource?.type ?? "");
  let deployment = null;
  let version = null;
  if (type === "scripts.deployments") {
    deployment = response.id ?? null;
    version = request.versions?.[0]?.version_id ?? null;
  } else if (type === "scripts.versions") {
    version = response.id ?? null;
  }
  return { deployment, version };
}

export const REASONS = {
  actor: "unexpected actor",
  outside: "outside every window",
  worker: "on another Worker than the step's",
  shape: "beyond the step's shape",
  second: "second of its kind in the window",
};

/**
 * Every unexpected entry, judged in the spec's order. Audit entries carry a Worker when their
 * path names one; the deployments and versions come from a Worker's own list, so they carry it
 * always. Inside a window an expected actor may write each kind once on the step's Worker;
 * anything else is a finding, and a kind missing from a window is not.
 */
export function judge({ entries = [], deployments = [], versions = [], windows: made = [] }) {
  const findings = [];
  // Counted per window object, so a re-run's two attempts, which share a run, a job name and a
  // step name, never share a count; and per source, since the log and the lists describe the
  // same events: a deploy's "Create Deployment" entry and its deployment list item are one
  // event seen twice, not two.
  const seen = new Map();
  const once = (window, kind, source) => {
    if (!seen.has(window)) seen.set(window, new Map());
    const counts = seen.get(window);
    const key = `${source}:${kind}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return count === 1;
  };
  const containing = (at) => made.filter((w) => w.start <= at && at <= w.end);
  const place = (at, worker, kind, source) => {
    const candidates = containing(at);
    if (candidates.length === 0) return { reason: REASONS.outside };
    const onWorker = worker ? candidates.filter((w) => w.worker === worker) : candidates;
    if (onWorker.length === 0) return { reason: REASONS.worker };
    const fitting = onWorker.filter((w) => w.kinds.includes(kind));
    if (fitting.length === 0) return { reason: REASONS.shape };
    const window = fitting.find((w) => once(w, kind, source));
    if (!window) return { reason: REASONS.second };
    return { window };
  };

  for (const entry of entries) {
    const at = ms(entry?.action?.time);
    const actor = entry?.actor ?? {};
    if (!isExpectedActor(actor)) {
      findings.push({ kind: "audit", entry, reason: REASONS.actor });
      continue;
    }
    const placed = place(at, workerOf(entry?.raw?.uri), kindOf(entry), "audit");
    if (placed.reason) findings.push({ kind: "audit", entry, reason: placed.reason });
  }
  for (const item of deployments) {
    const placed = place(ms(item.created_on), item.worker, "Create Deployment", "list");
    if (placed.reason) findings.push({ kind: "deployment", item, reason: placed.reason });
  }
  for (const item of versions) {
    const placed = place(ms(item.metadata?.created_on), item.worker, "Upload Version", "list");
    if (placed.reason) findings.push({ kind: "version", item, reason: placed.reason });
  }
  return findings;
}

/**
 * The one door every string from outside passes through: control characters, format
 * characters, combining marks and the Unicode line separators go, so do backticks, pipes and
 * newlines, the length is capped at 120 characters (code points, so no surrogate is cut in
 * half), an emptied string reads as the word `empty`, and the result sits in a code span
 * (spec 2.4).
 */
export function safe(text) {
  const kept = Array.from(
    String(text ?? "")
      .replace(/[\p{Cc}\p{Cf}\p{M}\p{Zl}\p{Zp}`|]/gu, "")
      .trim(),
  )
    .slice(0, 120)
    .join("")
    .trim();
  return `\`${kept === "" ? "empty" : kept}\``;
}

const prefix = (id) => (id ? String(id).slice(0, 8) : null);

/** The fixed words for an actor; a token's name is chosen text and goes through `safe`. */
export function actorLabel(actor) {
  if (actor?.type === "delegated_service") return "Cloudflare service";
  switch (actor?.context) {
    case "api_token":
      return `token ${safe(tokenName(actor))}`;
    case "dash":
      return "dashboard";
    case "oauth":
      return "OAuth session";
    case "api_key":
      return "global API key";
    default:
      return "other";
  }
}

const KNOWN = new Set(DEPLOY_KINDS);

/**
 * One report line per finding, in the two shapes of plan decision 7: the ids and the times
 * first, before any backtick (they are Cloudflare's fixed-format values, never chosen text, and
 * the state read needs the ids bare), then fixed words, then the chosen text in code spans.
 * Nothing else from the entry is read here, so nothing else can be printed.
 */
export function line(finding) {
  if (finding.kind === "audit") {
    const { entry, reason } = finding;
    const { deployment, version } = idsOf(entry);
    const head = [
      entry.id,
      prefix(deployment) && `[${prefix(deployment)}]`,
      prefix(version) && `[${prefix(version)}]`,
    ]
      .filter(Boolean)
      .join(" ");
    // The description is printed only when it is one of the fixed kinds a deploy makes, and a
    // route or domain write by its fixed name; anything else is its resource type, chosen by
    // Cloudflare and not by a caller, inside a code span and marked "other".
    const kind = kindOf(entry);
    const what = KNOWN.has(kind)
      ? kind
      : kind === ROUTE_KIND
        ? ROUTE_KIND
        : `${safe(entry?.resource?.type)} (other)`;
    const worker = workerOf(entry?.raw?.uri);
    return `- ${head} ${entry?.action?.time ?? ""} ${reason}: ${actorLabel(entry?.actor)}, ${what}${worker ? `, on ${safe(worker)}` : ""}`;
  }
  if (finding.kind === "deployment") {
    const { item, reason } = finding;
    const version = item.versions?.[0]?.version_id;
    const head = [`[${prefix(item.id)}]`, prefix(version) && `[${prefix(version)}]`]
      .filter(Boolean)
      .join(" ");
    return `- ${head} ${item.created_on ?? ""} ${reason}: deployment, source ${safe(item.source)}, on ${safe(item.worker)}`;
  }
  const { item, reason } = finding;
  const message = item.annotations?.["workers/message"];
  return `- [${prefix(item.id)}] ${item.metadata?.created_on ?? ""} ${reason}: version, source ${safe(item.metadata?.source)}, on ${safe(item.worker)}${message ? `, message ${safe(message)}` : ""}`;
}

const timeOf = (finding) =>
  ms(
    finding.kind === "audit"
      ? finding.entry?.action?.time
      : finding.kind === "deployment"
        ? finding.item?.created_on
        : finding.item?.metadata?.created_on,
  ) ?? 0;

const workerRank = (finding) => {
  const worker =
    finding.kind === "audit" ? workerOf(finding.entry?.raw?.uri) : finding.item?.worker;
  return worker === WORKERS.production ? 0 : worker === WORKERS.preview ? 1 : 2;
};
const kindRank = (finding) => (finding.kind === "audit" ? 1 : 0);

/**
 * The full report and the issue body: production lines before preview lines, deployments and
 * versions before audit entries, each group in time order; the body capped at CAP lines with a
 * count line naming where the rest is (spec 2.4). The full report is the job's artifact and
 * its summary; the body is the issue's.
 */
export function format(findings, { runUrl = "" } = {}) {
  const ordered = [...findings].sort(
    (a, b) => workerRank(a) - workerRank(b) || kindRank(a) - kindRank(b) || timeOf(a) - timeOf(b),
  );
  const lines = ordered.map(line);
  const full = lines.join("\n");
  if (lines.length <= CAP) return { full, body: full, count: lines.length };
  const rest = lines.length - CAP;
  const body = [
    ...lines.slice(0, CAP),
    `- and ${rest} more; the whole report is this run's artifact and summary: ${runUrl}`,
  ].join("\n");
  return { full, body, count: lines.length };
}

/**
 * The ids a previous report named, read from the fixed places the layout gives them: the body
 * is split on LF alone, and on each list line only the part before the first backtick is
 * read, where the leading audit-log id and every bracketed prefix live (plan decision 7).
 */
export function reportedIds(texts) {
  const ids = new Set();
  for (const text of texts) {
    for (const raw of String(text ?? "").split("\n")) {
      if (!raw.startsWith("- ")) continue;
      const head = raw.slice(2).split("`")[0];
      const leading = /^([0-9a-f]{8}-[0-9a-f-]{27})/i.exec(head);
      if (leading) ids.add(leading[1].toLowerCase());
      for (const [, id] of head.matchAll(/\[([0-9a-f]{8})\]/gi)) ids.add(id.toLowerCase());
    }
  }
  return ids;
}

/** Findings not already named: by audit-log id, or by the eight characters of a list id. */
export function unreported(findings, ids) {
  return findings.filter((finding) => {
    if (finding.kind === "audit") return !ids.has(String(finding.entry?.id ?? "").toLowerCase());
    return !ids.has(String(prefix(finding.item?.id) ?? "").toLowerCase());
  });
}
