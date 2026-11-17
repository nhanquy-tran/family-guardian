"use strict";

const REPO_PARAM = new URLSearchParams(location.search).get("repo") || "";
const REPO = /^[\w.-]+\/[\w.-]+$/.test(REPO_PARAM) ? REPO_PARAM : "nhanquy-tran/family-guardian";
const API = "https://api.github.com";
const TOKEN_KEY = "factory-dashboard-token";
const COLUMNS = ["needs-spec", "spec-in-progress", "spec-review", "ready", "in-progress", "in-review", "needs-human"];
const AGENT_WORKFLOWS = /^Factory [134]:/;
const SHOWN_WORKFLOWS = /^(Factory [134]:|CI$)/;
const HISTORY_WORKFLOWS = ["factory-spec.yml", "factory-build.yml", "claude.yml"];
const TRUSTED_AUTHORS = ["OWNER", "MEMBER", "COLLABORATOR"];

const state = { issues: [], pulls: [], runs: [], history: [], metrics: [], reviews: new Map(), gates: [], models: [], linked: new Map(), byNumber: new Map() };
const shaCache = new Map();

// ---------- helpers ----------

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
function setToken(value) {
  try { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

class Raw { constructor(s) { this.s = s; } }
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function toHtml(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(toHtml).join("");
  if (v === null || v === undefined || v === false) return "";
  return esc(v);
}
// Tagged template: every interpolated value is escaped unless it is already html`...` output.
function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += toHtml(v) + strings[i + 1]; });
  return new Raw(out);
}
function put(id, content) { document.getElementById(id).innerHTML = toHtml(content); }

const $ = (id) => document.getElementById(id);
const money = (n) => "$" + (n || 0).toFixed(2);
function duration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)} s`;
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
function age(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function startOfWeek() {
  const d = new Date(startOfToday());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
const ghUrl = (path) => `https://github.com/${REPO}/${path}`;

// ---------- GitHub API ----------

async function gh(path, { method = "GET", body, raw = false } = {}) {
  const headers = { Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-cache" });
  const left = res.headers.get("x-ratelimit-remaining");
  if (left !== null) {
    const reset = new Date(Number(res.headers.get("x-ratelimit-reset")) * 1000);
    const at = reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    $("rate").textContent = `GitHub API: ${left} left (resets ${at})`;
    $("rate").title = `${left} of ${res.headers.get("x-ratelimit-limit")} GitHub API requests left this hour`;
  }
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message || msg; } catch { /* not json */ }
    if (res.status === 403 && left === "0") msg = "rate limit reached, add a token or wait";
    const err = new Error(`${res.status} ${msg}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return raw ? text : text ? JSON.parse(text) : null;
}

async function ghPages(path, maxPages) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const items = await gh(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

// Responses for a fixed commit never change, so they are cached for the life of the page.
async function ghBySha(key, path, opts) {
  if (!shaCache.has(key)) shaCache.set(key, gh(path, opts).catch((e) => { shaCache.delete(key); throw e; }));
  return shaCache.get(key);
}

// ---------- data ----------

function parseMetrics(comments) {
  const out = [];
  for (const c of comments) {
    const trusted = TRUSTED_AUTHORS.includes(c.author_association) || c.user?.login === "github-actions[bot]";
    const m = trusted && /<!-- factory-metrics (\{.*?\}) -->/.exec(c.body || "");
    if (!m) continue;
    try {
      const data = JSON.parse(m[1]);
      out.push({ ...data, target: Number(c.issue_url.split("/").pop()), at: data.at || c.created_at, url: c.html_url });
    } catch { /* malformed comment */ }
  }
  return out;
}

// Reviewer comments, newest first per PR. Verdict from the hidden factory-review marker, else from the text.
function parseReview(c) {
  if (c.user?.login !== "github-actions[bot]" || /factory-metrics/.test(c.body || "") || !/Verdict:|factory-review/.test(c.body || "")) return null;
  const body = c.body || "";
  let data = null;
  const m = /<!-- factory-review (\{[^}]*\}) -->/.exec(body);
  if (m) { try { data = JSON.parse(m[1]); } catch { /* fall back to the text */ } }
  const verdict = data?.verdict || (/verdict:[* ]*changes needed/i.test(body) ? "changes-needed" : /verdict:[* ]*looks good/i.test(body) ? "looks-good" : "unknown");
  const findingsText = body.split(/human check/i)[0];
  const findings = data ? (data.high || 0) + (data.medium || 0) + (data.low || 0) : (findingsText.match(/^\s*\d+\.\s/gm) || []).length;
  return { verdict, findings, at: c.created_at, url: c.html_url, body: body.replace(/<!-- factory-review[^>]*-->/, "").trim() };
}

function parseReviews(comments) {
  const map = new Map();
  for (const c of comments) {
    const review = parseReview(c);
    if (!review) continue;
    const n = Number(c.issue_url.split("/").pop());
    map.set(n, [...(map.get(n) || []), review].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)));
  }
  return map;
}

// The newest review at a moment (for example at the merge), or the newest overall.
function reviewAt(prNumber, iso) {
  return (state.reviews.get(prNumber) || []).find((r) => !iso || Date.parse(r.at) <= Date.parse(iso)) || null;
}

function linkPulls() {
  state.linked = new Map();
  for (const pr of state.pulls) {
    const m = /^(spec|factory)\/(\d+)$/.exec(pr.head.ref);
    if (!m) continue;
    const n = Number(m[2]);
    const entry = state.linked.get(n) || {};
    if (!entry[m[1]] || pr.number > entry[m[1]].number) entry[m[1]] = pr;
    state.linked.set(n, entry);
  }
}

// Maps an issue or PR number to the issue it belongs to (PRs via their spec/<n> or factory/<n> branch).
function issueOf(number) {
  const pr = state.pulls.find((p) => p.number === number);
  const m = pr && /^(?:spec|factory)\/(\d+)$/.exec(pr.head.ref);
  return m ? Number(m[1]) : number;
}

async function load() {
  $("status").textContent = "Loading…";
  $("banner").hidden = true;
  try {
    const [items, pulls, runs, comments, history] = await Promise.all([
      ghPages(`/repos/${REPO}/issues?state=all`, 3),
      ghPages(`/repos/${REPO}/pulls?state=all`, 2),
      gh(`/repos/${REPO}/actions/runs?per_page=100`).then((r) => r.workflow_runs),
      ghPages(`/repos/${REPO}/issues/comments?sort=created&direction=desc`, 3),
      Promise.all(HISTORY_WORKFLOWS.map((w) => gh(`/repos/${REPO}/actions/workflows/${w}/runs?per_page=100&exclude_pull_requests=true`)
        .then((r) => r.workflow_runs).catch(() => []))).then((lists) => lists.flat()),
    ]);
    state.issues = items.filter((i) => !i.pull_request);
    state.byNumber = new Map(items.map((i) => [i.number, i]));
    state.pulls = pulls;
    state.runs = runs.filter((r) => SHOWN_WORKFLOWS.test(r.name) && r.conclusion !== "skipped");
    state.metrics = parseMetrics(comments);
    state.reviews = parseReviews(comments);
    state.gates = parseGates(comments);
    state.history = history.filter((r) => r.conclusion !== "skipped");
    linkPulls();
    state.models = buildIssueModels();
    renderBoard();
    renderRuns();
    renderCost();
    renderHealth();
    renderWorkflow();
    $("status").textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    await renderSpecs();
  } catch (e) {
    showBanner(`Could not load: ${e.message}`);
    $("status").textContent = "";
  }
}

function showBanner(text) {
  $("banner").textContent = text;
  $("banner").hidden = false;
}

// ---------- board ----------

function prLink(kind, pr) {
  if (!pr) return "";
  const st = pr.merged_at ? "merged" : pr.state;
  return html`<a href="${pr.html_url}" target="_blank" rel="noopener">${kind} #${pr.number}</a> <span class="st-${st}">${st}</span>`;
}

function prChip(kind, pr) {
  if (!pr) return "";
  const st = pr.merged_at ? "merged" : pr.state;
  const review = reviewAt(pr.number, pr.merged_at);
  const flag = review && review.verdict === "changes-needed" ? html`<span class="verdict bad" title="AI review: changes needed (${review.findings} findings)">!</span>` : "";
  return html`<a class="pr st-${st}" href="${pr.html_url}" target="_blank" rel="noopener" title="${kind} PR #${pr.number}: ${st}">${kind[0].toUpperCase()}#${pr.number}${flag}</a>`;
}

function issueCard(issue) {
  const labels = issue.labels.map((l) => l.name);
  const areas = labels.filter((l) => l.startsWith("area:") || l === "bug").map((l) => l.replace("area:", ""));
  const prs = state.linked.get(issue.number) || {};
  const acts = [];
  if (issue.state === "open" && getToken()) {
    if (!labels.some((l) => COLUMNS.includes(l)) && !labels.includes("human-task")) {
      acts.push(html`<button class="small" data-act="label" data-n="${issue.number}" data-label="needs-spec" title="Add label needs-spec">needs-spec</button>`);
    }
    if (labels.includes("ready")) {
      acts.push(html`<button class="small" data-act="label" data-n="${issue.number}" data-label="build-now" title="Add label build-now">build-now</button>`);
    }
    for (const pr of [prs.spec, prs.factory]) {
      if (pr && pr.state === "open") acts.push(html`<button class="small primary" data-act="merge" data-n="${pr.number}">Merge #${pr.number}</button>`);
    }
    acts.push(html`<button class="small icon" data-act="comment" data-n="${issue.number}" title="Comment on #${issue.number}" aria-label="Comment">💬</button>`);
  }
  return html`<div class="card">
    <div class="title" title="${issue.title}"><a href="${issue.html_url}" target="_blank" rel="noopener">#${issue.number}</a> ${issue.title}</div>
    <div class="meta">
      ${areas.map((a) => html`<span class="chip">${a}</span>`)}
      <span title="Created ${issue.created_at}">${age(issue.created_at)}</span>
      ${prChip("spec", prs.spec)}${prChip("factory", prs.factory)}
      ${acts.length ? html`<span class="acts">${acts}</span>` : ""}
    </div>
  </div>`;
}

function renderBoard() {
  const cols = new Map([["backlog", []], ...COLUMNS.map((c) => [c, []]), ["done", []], ["human-task", []]]);
  for (const issue of state.issues) {
    const labels = issue.labels.map((l) => l.name);
    if (issue.state === "closed") cols.get("done").push(issue);
    else if (labels.includes("human-task")) cols.get("human-task").push(issue);
    else cols.get([...COLUMNS].reverse().find((c) => labels.includes(c)) || "backlog").push(issue);
  }
  cols.set("done", cols.get("done").sort((a, b) => Date.parse(b.closed_at) - Date.parse(a.closed_at)).slice(0, 15));
  for (const [name, list] of cols) if (name !== "done") list.sort((a, b) => a.number - b.number);

  // Empty columns collapse to a thin strip; busy columns get more width so their cards flow into a grid.
  put("board-cols", [...cols].map(([name, list]) => html`<div class="col${list.length ? "" : " empty"}${name === "human-task" ? " human" : ""}"${list.length ? html` style="flex-grow:${Math.min(3, Math.ceil(list.length / 5))}"` : ""}>
    <h4><span>${name}</span><span class="count">${list.length}</span></h4>
    ${list.length ? html`<div class="list">${list.map(issueCard)}</div>` : ""}
  </div>`));
}

// ---------- specs ----------

function taskProgress(md) {
  const done = (md.match(/^\s*- \[[xX]\]/gm) || []).length;
  const todo = (md.match(/^\s*- \[ \]/gm) || []).length;
  return { done, total: done + todo };
}

async function changeFolderOf(pr) {
  const files = await ghBySha(`files:${pr.number}:${pr.head.sha}`, `/repos/${REPO}/pulls/${pr.number}/files?per_page=100`);
  for (const f of files) {
    const m = /^openspec\/changes\/([^/]+)\//.exec(f.filename);
    if (m && m[1] !== "archive") return m[1];
  }
  return null;
}

async function readTasks(folder, sha, archived) {
  const path = archived ? `openspec/changes/archive/${archived}/tasks.md` : `openspec/changes/${folder}/tasks.md`;
  try {
    const url = `/repos/${REPO}/contents/${path}${sha ? `?ref=${sha}` : ""}`;
    const md = sha ? await ghBySha(`tasks:${sha}:${path}`, url, { raw: true }) : await gh(url, { raw: true });
    return taskProgress(md);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function renderSpecs() {
  const allSpecPrs = state.pulls.filter((p) => p.labels.some((l) => l.name === "spec") && (p.state === "open" || p.merged_at));
  const { items: specPrs, pager } = pageOf("specs", allSpecPrs);
  const [active, archive] = await Promise.all([
    gh(`/repos/${REPO}/contents/openspec/changes`).catch(() => []),
    gh(`/repos/${REPO}/contents/openspec/changes/archive`).catch(() => []),
  ]);
  const activeNames = active.filter((e) => e.type === "dir" && e.name !== "archive").map((e) => e.name);
  const archivedNames = archive.filter((e) => e.type === "dir").map((e) => e.name);

  const rows = await Promise.all(specPrs.map(async (pr) => {
    const folder = await changeFolderOf(pr).catch(() => null);
    const issueNo = issueOf(pr.number);
    const factory = (state.linked.get(issueNo) || {}).factory;
    let where = "main";
    let progress = null;
    if (folder) {
      // Live progress: open factory branch first, then the open spec branch, then main, then the archive.
      if (factory && factory.state === "open") { where = `factory/${issueNo}`; progress = await readTasks(folder, factory.head.sha); }
      else if (pr.state === "open") { where = `spec/${issueNo}`; progress = await readTasks(folder, pr.head.sha); }
      else if (activeNames.includes(folder)) progress = await readTasks(folder, null);
      else {
        const arch = archivedNames.find((n) => n.endsWith(`-${folder}`));
        where = "archived";
        if (arch) progress = await readTasks(folder, null, arch);
      }
    }
    return { pr, folder, issueNo, where, progress };
  }));

  put("specs-body", rows.length ? html`<table>
    <thead><tr><th>PR</th><th>Issue</th><th>Change</th><th>Tasks</th><th>Read from</th><th></th></tr></thead>
    <tbody>${rows.map(specRow)}</tbody></table>${pager}` : html`<p class="muted">No spec PRs yet.</p>`);
}

function specRow({ pr, folder, issueNo, where, progress }) {
  const issue = issueNo && state.byNumber.get(issueNo);
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const canMerge = pr && pr.state === "open" && getToken();
  return html`<tr>
    <td>${pr ? prLink("spec", pr) : html`<span class="muted">none</span>`}</td>
    <td class="wrap">${issue ? html`<a href="${issue.html_url}" target="_blank" rel="noopener">#${issue.number}</a> ${issue.title}` : ""}</td>
    <td><code>${folder || "?"}</code></td>
    <td>${progress ? html`<span class="progress"><span style="width:${pct}%"></span></span>${progress.done}/${progress.total}` : html`<span class="muted">n/a</span>`}</td>
    <td class="muted">${where}</td>
    <td>${canMerge ? html`<button class="small primary" data-act="merge" data-n="${pr.number}">Merge</button>` : ""}</td>
  </tr>`;
}

// ---------- runs ----------

function runMs(run) {
  const start = Date.parse(run.run_started_at || run.created_at);
  const end = run.status === "completed" ? Date.parse(run.updated_at) : Date.now();
  return Math.max(0, end - start);
}

function renderRuns() {
  const today = startOfToday();
  const week = startOfWeek();
  const agentRuns = state.runs.filter((r) => AGENT_WORKFLOWS.test(r.name));
  const sum = (from) => agentRuns.filter((r) => Date.parse(r.run_started_at) >= from).reduce((s, r) => s + runMs(r), 0);
  const running = state.runs.filter((r) => r.status !== "completed").length;
  put("agent-time", [
    tile(duration(sum(today)), "agent time today"),
    tile(duration(sum(week)), "agent time this week"),
    tile(String(running), "runs in progress"),
  ]);

  const costByRun = new Map();
  for (const m of state.metrics) costByRun.set(m.run_id, (costByRun.get(m.run_id) || 0) + (m.cost_usd || 0));
  const canAct = !!getToken();
  const { items, pager } = pageOf("runs", state.runs);
  put("runs-body", html`<table>
    <thead><tr><th>Workflow</th><th>Branch</th><th>Event</th><th>Result</th><th>Started</th><th class="num">Duration</th><th class="num">Cost</th><th></th></tr></thead>
    <tbody>${items.map((r) => {
      const st = r.status === "completed" ? r.conclusion : r.status;
      const failed = ["failure", "cancelled", "timed_out"].includes(r.conclusion);
      return html`<tr>
        <td><a href="${r.html_url}" target="_blank" rel="noopener">${r.name}</a></td>
        <td>${r.head_branch}</td>
        <td class="muted">${r.event}</td>
        <td class="st-${st}">${st}</td>
        <td title="${r.run_started_at}">${age(r.run_started_at)} ago</td>
        <td class="num">${duration(runMs(r))}</td>
        <td class="num">${costByRun.has(r.id) ? money(costByRun.get(r.id)) : ""}</td>
        <td>${failed && canAct ? html`<button class="small" data-act="rerun" data-run="${r.id}" data-name="${r.name}">Re-run failed</button>` : ""}</td>
      </tr>`;
    })}</tbody></table>${pager}`);
}

const PAGE_SIZE = 20;
const pages = { specs: 0, runs: 0, cost: 0, health: 0 };

// Returns the current page of a list (newest first) and the pager controls for it.
function pageOf(key, list) {
  const count = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  pages[key] = Math.min(pages[key], count - 1);
  const start = pages[key] * PAGE_SIZE;
  const end = Math.min(list.length, start + PAGE_SIZE);
  const pager = list.length > PAGE_SIZE ? html`<div class="pager">
    <span class="muted">${start + 1}–${end} of ${list.length}</span>
    <button type="button" class="small" data-act="page" data-key="${key}" data-to="${pages[key] - 1}"${pages[key] === 0 ? html` disabled` : ""}>Previous</button>
    <span>Page ${pages[key] + 1} of ${count}</span>
    <button type="button" class="small" data-act="page" data-key="${key}" data-to="${pages[key] + 1}"${pages[key] >= count - 1 ? html` disabled` : ""}>Next</button>
  </div>` : "";
  return { items: list.slice(start, end), pager };
}

function tile(value, label) {
  return html`<div class="tile"><div class="v">${value}</div><div class="l">${label}</div></div>`;
}

// ---------- per-issue model (cost, health, timeline) ----------

// The steps of one issue in workflow order. Agent steps come from metrics comments and runs; wait steps from PR times.
const STEPS = [
  { key: "spec", label: "Spec writer", phase: "spec", kind: "agent" },
  { key: "spec-review", label: "AI review", phase: "spec", kind: "review" },
  { key: "spec-fix", label: "Fixes", phase: "spec", kind: "fix" },
  { key: "spec-gate", label: "Spec gate", phase: "spec", kind: "wait" },
  { key: "queue", label: "Queue", phase: "build", kind: "wait" },
  { key: "tests", label: "Test writer", phase: "build", kind: "agent" },
  { key: "dev", label: "Developer", phase: "build", kind: "agent" },
  { key: "verify", label: "Verifier", phase: "build", kind: "agent" },
  { key: "build-review", label: "AI review", phase: "build", kind: "review" },
  { key: "build-fix", label: "Debug, fixes", phase: "build", kind: "fix" },
  { key: "build-gate", label: "Build gate", phase: "build", kind: "wait" },
];
const AGENT_STEPS = STEPS.filter((s) => s.kind !== "wait");
// Reviewers (reviewer, spec-reviewer, quality-reviewer) and fix rounds (fixer, debugger) are placed by their target.
const AGENT_STEP = { "spec-writer": "spec", "test-writer": "tests", developer: "dev", verifier: "verify" };
const stepLabel = (key) => {
  const s = STEPS.find((x) => x.key === key);
  return s.kind === "wait" ? s.label : `${s.label} (${s.phase})`;
};

function short(ms) {
  if (ms === null || ms === undefined) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
const sumOf = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);

// Claude Gate comments, written by the interactive Claude session that takes the gates (ADR 0013).
function parseGates(comments) {
  return comments
    .filter((c) => TRUSTED_AUTHORS.includes(c.author_association) && /^Gate \(Claude\)/.test(c.body || ""))
    .map((c) => {
      const first = c.body.split("\n")[0];
      return { target: Number(c.issue_url.split("/").pop()), at: Date.parse(c.created_at), url: c.html_url, approved: /approved/i.test(first) && !/changes needed/i.test(first), text: first.slice(0, 200) };
    });
}

// Finds the issue a run without metrics belongs to: "#n" in the run name, else a PR or issue with the run's title.
function runTarget(run) {
  const title = run.display_title || "";
  const pr = state.pulls.find((p) => p.title === title);
  if (pr) return pr.number;
  const issue = state.issues.find((i) => i.title === title);
  if (issue) return issue.number;
  const m = /#(\d+)\)?$/.exec(title);
  return m ? Number(m[1]) : null;
}

function buildIssueModels() {
  const models = new Map();
  const model = (n) => {
    if (!models.has(n)) models.set(n, { n, acts: [], gates: [], prs: state.linked.get(n) || {} });
    return models.get(n);
  };
  const isBuildPr = (n, target) => (state.linked.get(n) || {}).factory?.number === target;
  const afterSpec = (n, t) => {
    const merged = (state.linked.get(n) || {}).spec?.merged_at;
    return !!merged && t > Date.parse(merged);
  };
  const measured = new Set();
  const failedRuns = new Set(state.history.filter((r) => ["failure", "timed_out", "cancelled"].includes(r.conclusion)).map((r) => r.id));

  for (const m of state.metrics) {
    const n = issueOf(m.target);
    const end = Date.parse(m.at);
    const onBuild = isBuildPr(n, m.target) || (m.target === n && afterSpec(n, end));
    const step = AGENT_STEP[m.agent] || (/reviewer$/.test(m.agent) ? (isBuildPr(n, m.target) ? "build-review" : "spec-review")
      : m.agent === "debugger" || onBuild ? "build-fix" : "spec-fix");
    measured.add(`${m.run_id}:${m.agent === "fixer" ? "fix" : "factory"}`);
    model(n).acts.push({ step, start: end - (m.duration_ms || 0), end, cost: m.cost_usd || 0, turns: m.turns || 0, run: m.run_id, attempt: m.run_attempt || 1, ok: !m.is_error && !failedRuns.has(m.run_id), url: m.url, agent: m.agent });
  }

  // Runs that posted no metrics: @claude fix rounds (before they were measured) and factory runs that failed early.
  for (const run of state.history) {
    const fix = run.path.endsWith("claude.yml");
    if (measured.has(`${run.id}:${fix ? "fix" : "factory"}`)) continue;
    const target = runTarget(run);
    if (!target) continue;
    const n = issueOf(target);
    if (!state.byNumber.has(n)) continue;
    const start = Date.parse(run.run_started_at || run.created_at);
    const end = run.status === "completed" ? Date.parse(run.updated_at) : Date.now();
    let step = run.path.endsWith("factory-spec.yml") ? "spec" : "tests";
    if (fix) {
      const specMerged = model(n).prs.spec?.merged_at;
      step = isBuildPr(n, target) || (target === n && specMerged && start > Date.parse(specMerged)) ? "build-fix" : "spec-fix";
    }
    model(n).acts.push({ step, start, end, cost: null, turns: null, run: run.id, attempt: run.run_attempt || 1, ok: run.conclusion === "success" || run.status !== "completed", url: run.html_url, agent: fix ? "@claude" : run.name, unmeasured: true });
  }

  for (const g of state.gates) {
    const n = issueOf(g.target);
    model(n).gates.push({ ...g, phase: isBuildPr(n, g.target) ? "build" : model(n).prs.spec?.merged_at && g.at > Date.parse(model(n).prs.spec.merged_at) ? "build" : "spec" });
  }

  for (const m of models.values()) deriveIssue(m);
  const issueNumbers = new Set(state.issues.map((i) => i.number));
  return [...models.values()].filter((m) => issueNumbers.has(m.n)).sort((a, b) => b.n - a.n);
}

// Waits: gate = from the last agent activity of a phase to the PR merge; queue = spec merged to first build activity.
function deriveIssue(m) {
  const now = Date.now();
  const t = (iso) => (iso ? Date.parse(iso) : null);
  const { spec, factory } = m.prs;
  m.acts.sort((a, b) => a.start - b.start);
  const inPhase = (phase) => m.acts.filter((a) => STEPS.find((s) => s.key === a.step).phase === phase);
  const lastEnd = (acts, until) => Math.max(0, ...acts.filter((a) => !until || a.end <= until).map((a) => a.end));

  m.waits = {};
  const specMerged = t(spec?.merged_at);
  const buildActs = inPhase("build");
  if (spec) {
    const from = Math.max(t(spec.created_at), lastEnd(inPhase("spec"), specMerged));
    m.waits["spec-gate"] = { start: t(spec.created_at), from, end: specMerged || (spec.state === "open" ? now : t(spec.closed_at)), open: !specMerged };
  }
  if (specMerged) {
    const firstBuild = buildActs.length ? buildActs[0].start : t(factory?.created_at);
    m.waits.queue = { start: specMerged, from: specMerged, end: firstBuild || now, open: !firstBuild };
  }
  if (factory) {
    const merged = t(factory.merged_at);
    const from = Math.max(t(factory.created_at), lastEnd(buildActs, merged));
    m.waits["build-gate"] = { start: t(factory.created_at), from, end: merged || (factory.state === "open" ? now : t(factory.closed_at)), open: !merged };
  }

  m.stepMs = {};
  m.stepCost = {};
  m.stepCount = {};
  for (const s of STEPS) {
    const acts = m.acts.filter((a) => a.step === s.key);
    m.stepCount[s.key] = acts.length;
    m.stepMs[s.key] = s.kind === "wait" ? (m.waits[s.key] ? m.waits[s.key].end - m.waits[s.key].from : null) : acts.length ? sumOf(acts, (a) => a.end - a.start) : null;
    m.stepCost[s.key] = acts.some((a) => a.cost !== null) ? sumOf(acts, (a) => a.cost) : null;
  }
  m.claudeMs = sumOf(m.acts, (a) => a.end - a.start);
  m.cost = sumOf(m.acts, (a) => a.cost);
  m.unmeasured = m.acts.filter((a) => a.unmeasured).length;
  m.start = Math.min(...m.acts.map((a) => a.start), spec ? t(spec.created_at) : Infinity);
  m.done = !!factory?.merged_at;
  m.end = m.done ? t(factory.merged_at) : now;
  m.e2e = Number.isFinite(m.start) ? m.end - m.start : null;
  m.waitMs = sumOf(Object.values(m.waits), (w) => w.end - w.from);

  const runsOf = (steps) => new Set(m.acts.filter((a) => steps.includes(a.step)).map((a) => a.run)).size;
  const reruns = [...new Map(m.acts.map((a) => [a.run, a.attempt])).values()].reduce((s, x) => s + x - 1, 0);
  m.retry = {
    spec: Math.max(0, runsOf(["spec"]) - 1),
    build: Math.max(0, runsOf(["tests", "dev"]) - 1),
    specFix: m.stepCount["spec-fix"],
    buildFix: m.stepCount["build-fix"],
    reruns,
    specGateRounds: m.gates.filter((g) => g.phase === "spec" && !g.approved).length,
    buildGateRounds: m.gates.filter((g) => g.phase === "build" && !g.approved).length,
  };
  m.retries = m.retry.spec + m.retry.build + m.retry.specFix + m.retry.buildFix + m.retry.reruns;
}

function issueButton(m) {
  const issue = state.byNumber.get(m.n);
  return html`<button type="button" class="link" data-act="issue" data-n="${m.n}" title="Show the timeline of #${m.n}">#${m.n}</button> ${issue ? issue.title : ""}`;
}

function phaseHeader(steps, extra) {
  const spec = steps.filter((s) => s.phase === "spec").length;
  const build = steps.length - spec;
  return html`<tr class="group"><th></th><th colspan="${spec}" class="phase spec">Spec</th><th colspan="${build}" class="phase build">Build</th><th colspan="${extra}"></th></tr>`;
}

// ---------- cost ----------

function renderCost() {
  const ms = state.metrics;
  const total = (list) => list.reduce((s, m) => s + (m.cost_usd || 0), 0);
  const since = (from) => ms.filter((m) => Date.parse(m.at) >= from);
  const done = state.models.filter((m) => m.done && m.cost);
  put("cost-tiles", [
    tile(money(total(since(startOfToday()))), "today"),
    tile(money(total(since(startOfWeek()))), "this week"),
    tile(money(total(ms)), "total"),
    tile(done.length ? money(sumOf(done, (m) => m.cost) / done.length) : "—", "per issue done end to end"),
  ]);
  const rows = state.models.filter((m) => m.acts.length);
  if (!rows.length) {
    put("cost-issues", html`<p class="muted">No metrics yet. They appear after the next factory run that includes the metrics step.</p>`);
    return;
  }
  const { items, pager } = pageOf("cost", rows);
  const stepTotal = (key) => sumOf(rows, (m) => m.stepCost[key]);
  put("cost-issues", html`<table class="steps">
    <thead>${phaseHeader(AGENT_STEPS, 1)}
      <tr><th>Issue</th>${AGENT_STEPS.map((s) => html`<th class="num ${s.phase}">${s.label}</th>`)}<th class="num">Total</th></tr></thead>
    <tbody>${items.map((m) => html`<tr data-issue="${m.n}">
      <td class="wrap">${issueButton(m)}</td>
      ${AGENT_STEPS.map((s) => html`<td class="num ${s.phase}">${m.stepCost[s.key] === null ? (m.stepCount[s.key] ? html`<span class="muted" title="Ran before its cost was measured">n/a</span>` : "") : money(m.stepCost[s.key])}</td>`)}
      <td class="num"><strong>${money(m.cost)}</strong></td>
    </tr>`)}</tbody>
    <tfoot><tr><td>Total, all ${rows.length} issues</td>
      ${AGENT_STEPS.map((s) => html`<td class="num ${s.phase}">${money(stepTotal(s.key))}</td>`)}
      <td class="num">${money(sumOf(rows, (m) => m.cost))}</td></tr></tfoot></table>${pager}`);
}

// ---------- factory health ----------

function median(xs) {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
}

function renderHealth() {
  const rows = state.models.filter((m) => m.acts.length || m.prs.spec);
  const done = rows.filter((m) => m.done);
  const mergedPrs = rows.flatMap((m) => [m.prs.spec, m.prs.factory]).filter((pr) => pr?.merged_at);
  const mergedReviews = mergedPrs.map((pr) => reviewAt(pr.number, pr.merged_at)).filter(Boolean);
  const claudeDone = sumOf(done, (m) => m.claudeMs);
  put("health-tiles", [
    tile(`${done.length}`, "issues done end to end"),
    tile(done.length ? short(median(done.map((m) => m.e2e))) : "—", "median end to end"),
    tile(done.length ? short(median(done.map((m) => m.claudeMs))) : "—", "median Claude agent time per issue"),
    tile(claudeDone ? `${Math.round((claudeDone / sumOf(done, (m) => m.e2e)) * 100)}%` : "—", "of end to end spent running agents"),
    tile(rows.length ? (sumOf(rows, (m) => m.retries) / rows.length).toFixed(1) : "—", "retries per issue (reruns, fix rounds)"),
    tile(`${mergedReviews.filter((r) => r.verdict === "changes-needed").length}/${mergedReviews.length}`, "PRs merged over an AI \"changes needed\""),
  ]);

  const cell = (m, s) => {
    const v = m.stepMs[s.key];
    if (v === null) return html`<td class="num ${s.phase}"></td>`;
    const count = m.stepCount[s.key];
    const open = s.kind === "wait" && m.waits[s.key]?.open;
    return html`<td class="num ${s.phase}${s.kind === "wait" ? " wait" : ""}" title="${open ? "still waiting" : ""}">${short(v)}${open ? "…" : ""}${count > 1 ? html` <span class="muted">×${count}</span>` : ""}</td>`;
  };
  const { items, pager } = pageOf("health", rows);
  const total = (f) => sumOf(rows, f);
  put("health-issues", rows.length ? html`<table class="steps">
    <thead>${phaseHeader(STEPS, 3)}
      <tr><th>Issue</th>${STEPS.map((s) => html`<th class="num ${s.phase}">${s.label}</th>`)}<th class="num">Claude time</th><th class="num">Retries</th><th class="num">End to end</th></tr></thead>
    <tbody>${items.map((m) => html`<tr data-issue="${m.n}">
      <td class="wrap">${issueButton(m)}</td>
      ${STEPS.map((s) => cell(m, s))}
      <td class="num">${short(m.claudeMs)}</td>
      <td class="num">${m.retries || ""}</td>
      <td class="num"><strong>${m.e2e === null ? "" : short(m.e2e)}</strong>${m.done ? "" : html` <span class="muted" title="Not merged yet: time so far">running</span>`}</td>
    </tr>`)}</tbody>
    <tfoot><tr><td>Total, all ${rows.length} issues</td>
      ${STEPS.map((s) => html`<td class="num ${s.phase}">${total((m) => m.stepMs[s.key]) ? short(total((m) => m.stepMs[s.key])) : "—"}</td>`)}
      <td class="num">${short(total((m) => m.claudeMs))}</td>
      <td class="num">${total((m) => m.retries)}</td>
      <td class="num" title="Includes the time so far of issues not merged yet">${short(total((m) => m.e2e))}</td></tr></tfoot></table>${pager}` : html`<p class="muted">No issue has gone through the factory yet.</p>`);
}

// ---------- issue timeline ----------

function tickStep(spanMs) {
  const minutes = [1, 2, 5, 10, 15, 30, 60, 120, 240, 360, 720, 1440, 2880, 10080];
  const maxTicks = window.innerWidth < 720 ? 3 : 8;
  return (minutes.find((m) => spanMs / (m * 60000) <= maxTicks) || 10080) * 60000;
}

function gantt(m) {
  const t0 = m.start;
  const t1 = Math.max(m.end, ...m.acts.map((a) => a.end));
  const total = Math.max(60000, t1 - t0);
  const pct = (t) => ((t - t0) / total) * 100;
  const multiDay = new Date(t0).toDateString() !== new Date(t1).toDateString();
  const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(multiDay ? { weekday: "short" } : {}) });
  const step = tickStep(total);
  const ticks = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t);

  const bar = (start, end, cls, title, url) => {
    const style = `left:${pct(start).toFixed(2)}%;width:${Math.max(0.5, pct(end) - pct(start)).toFixed(2)}%`;
    return url
      ? html`<a class="bar ${cls}" style="${style}" title="${title}" href="${url}" target="_blank" rel="noopener"></a>`
      : html`<span class="bar ${cls}" style="${style}" title="${title}"></span>`;
  };
  const rows = STEPS.map((s) => {
    let marks = [];
    if (s.kind === "wait") {
      const w = m.waits[s.key];
      if (w) {
        marks.push(bar(w.start, w.end, "pr-open", `${s.label}: PR open ${short(w.end - w.start)}`));
        marks.push(bar(w.from, w.end, "wait", `${s.label}: waiting ${short(w.end - w.from)}${w.open ? " so far" : ""}`));
      }
      for (const g of m.gates.filter((x) => x.phase === s.phase && s.key !== "queue")) {
        marks.push(html`<a class="gate ${g.approved ? "ok" : "no"}" style="left:${pct(g.at).toFixed(2)}%" href="${g.url}" target="_blank" rel="noopener" title="${clock(g.at)} ${g.text}"></a>`);
      }
    } else {
      marks = m.acts.filter((a) => a.step === s.key).map((a) => bar(a.start, a.end, `${s.kind} ${s.phase}${a.ok ? "" : " failed"}`,
        `${stepLabel(s.key)} · ${clock(a.start)} · ${short(a.end - a.start)}${a.cost !== null ? ` · ${money(a.cost)}` : ""}${a.turns ? ` · ${a.turns} turns` : ""}${a.attempt > 1 ? ` · attempt ${a.attempt}` : ""}${a.ok ? "" : " · failed"}`, a.url));
    }
    const ms = m.stepMs[s.key];
    return html`<div class="g-row${marks.length ? "" : " none"}">
      <div class="g-label"><span class="${s.phase}">${s.label}</span><span class="muted">${ms === null ? "" : short(ms)}</span></div>
      <div class="g-track">${marks}</div>
    </div>`;
  });
  return html`<div class="gantt">
    <div class="g-row g-axis"><div class="g-label"></div><div class="g-track">${ticks.map((t) => html`<span style="left:${pct(t).toFixed(2)}%">${clock(t)}</span>`)}</div></div>
    ${rows}
    <div class="g-row g-axis end"><div class="g-label"></div><div class="g-track"><span style="left:0">${clock(t0)} start</span><span class="right">${m.done ? "merged" : "now"} ${clock(m.end)}</span></div></div>
  </div>
  <p class="legend small muted"><span class="bar agent spec"></span> agent <span class="bar review spec"></span> AI review <span class="bar fix spec"></span> fix round <span class="bar wait"></span> waiting on gate or queue <span class="bar pr-open"></span> PR open <span class="gate ok"></span> gate approved <span class="gate no"></span> gate: changes <span class="bar agent spec failed"></span> failed</p>`;
}

function issueDetail(n) {
  const m = state.models.find((x) => x.n === n);
  const issue = state.byNumber.get(n);
  if (!m || !issue) return;
  const r = m.retry;
  const retryParts = [
    r.spec && `${r.spec} extra spec run${r.spec > 1 ? "s" : ""}`,
    r.specFix && `${r.specFix} spec fix round${r.specFix > 1 ? "s" : ""}`,
    r.build && `${r.build} extra build attempt${r.build > 1 ? "s" : ""}`,
    r.buildFix && `${r.buildFix} build fix round${r.buildFix > 1 ? "s" : ""}`,
    r.reruns && `${r.reruns} job re-run${r.reruns > 1 ? "s" : ""}`,
  ].filter(Boolean);
  const gates = [r.specGateRounds && `${r.specGateRounds} spec gate round${r.specGateRounds > 1 ? "s" : ""} with changes`, r.buildGateRounds && `${r.buildGateRounds} build gate round${r.buildGateRounds > 1 ? "s" : ""} with changes`].filter(Boolean);
  $("issue-title").textContent = `#${n} ${issue.title}`;
  put("issue-body", html`
    <p class="small"><a href="${issue.html_url}" target="_blank" rel="noopener">Issue on GitHub</a>
      ${m.prs.spec ? html` · ${prLink("spec", m.prs.spec)}` : ""}${m.prs.factory ? html` · ${prLink("build", m.prs.factory)}` : ""}</p>
    <div class="tiles">
      ${tile(m.e2e === null ? "—" : short(m.e2e), m.done ? "end to end, first activity to merged" : "so far, not merged yet")}
      ${tile(short(m.claudeMs) || "0s", "Claude agent time")}
      ${tile(short(m.waitMs) || "0s", "waiting on gates and queue")}
      ${tile(String(m.retries), "retries")}
      ${tile(money(m.cost), m.unmeasured ? "cost (some runs not measured)" : "cost")}
    </div>
    ${gantt(m)}
    <p class="small">${retryParts.length ? `Retries: ${retryParts.join(", ")}.` : "No retries: every step passed on the first run."}${gates.length ? ` Claude gate: ${gates.join(", ")}.` : ""}</p>
    <h3>Activities</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Step</th><th>Agent</th><th>Started</th><th class="num">Time</th><th class="num">Cost</th><th class="num">Turns</th><th>Result</th></tr></thead>
      <tbody>${m.acts.map((a) => html`<tr>
        <td>${stepLabel(a.step)}</td><td>${a.agent}</td>
        <td>${new Date(a.start).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</td>
        <td class="num">${short(a.end - a.start)}</td>
        <td class="num">${a.cost === null ? html`<span class="muted">n/a</span>` : money(a.cost)}</td>
        <td class="num">${a.turns ?? ""}</td>
        <td><a href="${a.url}" target="_blank" rel="noopener" class="${a.ok ? "st-success" : "st-failure"}">${a.ok ? "ok" : "failed"}</a>${a.attempt > 1 ? html` <span class="muted">attempt ${a.attempt}</span>` : ""}</td>
      </tr>`)}
      ${m.gates.map((g) => html`<tr><td>${g.phase === "spec" ? "Spec gate" : "Build gate"}</td><td>Claude</td>
        <td>${new Date(g.at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</td><td></td><td></td><td></td>
        <td><a href="${g.url}" target="_blank" rel="noopener" class="${g.approved ? "st-success" : "st-open"}">${g.approved ? "approved" : "changes"}</a></td></tr>`)}
      </tbody></table></div>
    <p class="small muted">Agent times are the Claude Code run time from each step's metrics comment. Runs without one (older @claude fix rounds, factory runs that failed early) use the GitHub run time and have no cost. Waits run from the last agent activity of a phase to the merge.</p>`);
  if (!$("issue-dialog").open) $("issue-dialog").showModal();
}

// ---------- factory workflow ----------

const KINDS = {
  human: "Owner",
  auto: "Automation",
  agent: "AI agent",
  eval: "Eval (deterministic)",
  check: "Quality gate",
  gate: "Decision gate",
};

// The factory as documented in docs/factory.md (ADR 0013, ADR 0017). `labels` link live issues to a node.
const FLOW = [
  { phase: "Plan", file: "factory-scheduler.yml, factory-router.yml", nodes: [
    { id: "issue", kind: "human", title: "Write the issue", who: "Owner",
      what: "One user-visible outcome, acceptance criteria as bullets, an area label and a `Depends on:` line. Label `autopilot` to let the scheduler run it, or `needs-spec` to start now.",
      labels: ["autopilot"] },
    { id: "scheduler", kind: "auto", title: "Scheduler", who: "Factory 6, every 30 min and on merges",
      what: "Picks `autopilot` issues in dependency order. Starts a spec when its dependencies are specified and a build when they are merged and no other build touches the same files.",
      pass: "At most 3 agent jobs in parallel (FACTORY_MAX_PARALLEL)." },
    { id: "router", kind: "auto", title: "Router", who: "Factory 0",
      what: "Turns labels into runs: `needs-spec` starts the spec writer, `build-now` starts a build.",
      fail: "Refuses `build-now` on an issue without an approved spec: removes the label and comments.",
      labels: ["needs-spec"] },
  ] },
  { phase: "Spec", file: "factory-spec.yml", nodes: [
    { id: "spec-writer", kind: "agent", title: "Spec writer", who: "spec-writer agent (Opus)",
      what: "Reads the current behaviour in `openspec/specs/` and writes an OpenSpec change: proposal, design, tasks and spec deltas with GIVEN/WHEN/THEN scenarios.",
      labels: ["spec-in-progress"] },
    { id: "spec-eval", kind: "eval", title: "Spec eval", who: "factory-eval.mjs spec",
      what: "Checks the change before anyone reads it.",
      pass: "All files exist, every requirement has scenarios, every scenario has WHEN and THEN, tasks.md names a test file, `openspec validate --strict` passes.",
      fail: "Adds `needs-human`; the result is in the PR's evidence table." },
    { id: "spec-review", kind: "agent", title: "AI review, stage 1", who: "spec-reviewer agent (Factory 4)",
      what: "Reviews the spec against the issue, the ADRs and the learnings.",
      pass: "Verdict \"looks good\": green `factory/review` status.",
      fail: "\"Changes needed\": red status and `review-changes-needed` label." },
    { id: "gate1", kind: "gate", title: "Gate 1: approve spec", who: "Claude, on the owner's behalf (ADR 0013)",
      what: "Critical review: issue fit, testable scenarios, failure paths, privacy, security, dependencies.",
      pass: "No high or medium findings: Claude merges the spec PR, Factory 2 labels the issue `ready`.",
      fail: "Asks for fixes with `@claude`, then the review runs again.",
      loop: "max 3 fix rounds, then escalates to the owner",
      labels: ["spec-review", "ready"] },
  ] },
  { phase: "Build", file: "factory-build.yml", nodes: [
    { id: "test-writer", kind: "agent", title: "Test writer", who: "test-writer agent",
      what: "Writes the tests from the scenarios before any code: visible tests named after each scenario, plus hidden acceptance tests in `acceptance/<change>/`.",
      labels: ["in-progress"] },
    { id: "evals-first", kind: "eval", title: "Tests fail first", who: "Workflow",
      what: "Proves the tests test something, and hides the acceptance tests from the developer.",
      pass: "Visible and hidden tests run and fail (not a syntax error), every scenario has a test with its title, hidden tests are removed from the tree." },
    { id: "developer", kind: "agent", title: "Developer", who: "developer agent",
      what: "Implements until the tests pass. It cannot edit tests, applied migrations, architecture docs or `.env`. Lint is auto-fixed afterwards." },
    { id: "gates", kind: "check", title: "Build gates", who: "Workflow",
      what: "Deterministic gates on the developer's work.",
      pass: "Tests not weakened (diff check), `npm run check` and `npm run build` pass, the test writer's tests pass.",
      fail: "Starts the debugger." },
    { id: "debugger", kind: "agent", title: "Debugger", who: "debugger agent, only when a gate fails",
      what: "Finds the root cause first, then fixes the code, or a test that is wrong by the spec (label `test-arbitrated`). The gates run again afterwards.",
      loop: "once per build, at most 3 fix attempts inside it" },
    { id: "hidden", kind: "eval", title: "Hidden acceptance tests", who: "Workflow",
      what: "Restores the tests the developer never saw and runs them.",
      pass: "All hidden acceptance tests pass.",
      fail: "Adds `needs-human`." },
    { id: "verifier", kind: "agent", title: "Verifier", who: "verifier agent",
      what: "Checks the build against the OpenSpec change for completeness, correctness and coherence and writes VERIFY.md.",
      pass: "`VERIFY: PASS`: the change is archived into `openspec/specs/`.",
      fail: "Adds `needs-human`." },
    { id: "pr", kind: "auto", title: "PR with evidence", who: "open-factory-pr.sh",
      what: "Opens `factory/<n>` with an evidence table: model, wall time and the result of every eval and gate.",
      fail: "Any failed eval or gate adds `needs-human`.",
      labels: ["needs-human"] },
  ] },
  { phase: "Review", file: "ci.yml, codeql.yml, factory-review.yml", nodes: [
    { id: "ci", kind: "check", title: "CI", who: "GitHub Actions",
      what: "Typecheck, lint, unit tests, build, gitleaks, migration checks and CodeQL on the PR.",
      pass: "All checks green; branch protection blocks the merge otherwise." },
    { id: "review1", kind: "agent", title: "AI review, stage 1", who: "spec-reviewer agent",
      what: "Does the PR do exactly what the spec says? Scenario to test to code.",
      pass: "No high or medium findings: stage 2 runs.",
      fail: "Red `factory/review` status, `review-changes-needed`." },
    { id: "review2", kind: "agent", title: "AI review, stage 2", who: "quality-reviewer agent",
      what: "Correctness bugs, simplicity and maintainability. Comments only, never approves." },
    { id: "gate2", kind: "gate", title: "Gate 2: approve build", who: "Claude, on the owner's behalf (ADR 0013)",
      what: "Reads the evidence, CI, the Vercel preview and the diff against spec and issue, and runs it where possible.",
      pass: "No high or medium findings: Claude merges and the issue closes.",
      fail: "Fix with `@claude`, or change the spec and rebuild.",
      loop: "max 2 build attempts. Always escalates privacy or security ADRs, destructive migrations, new services or secrets, and items over about $10",
      labels: ["in-review"] },
  ] },
  { phase: "Run", file: "factory-docs.yml, factory-watchdog.yml", nodes: [
    { id: "docs", kind: "agent", title: "Docs update", who: "docs-writer agent (Factory 7, nightly)",
      what: "Applies the \"Docs to update\" notes of merged changes to `docs/` in a docs PR." },
    { id: "watchdog", kind: "auto", title: "Watchdog", who: "Factory 5, every 30 min",
      what: "Restarts stalled agent runs and unblocks factory and spec PRs that conflict with main.",
      loop: "max 2 restarts, then `needs-human`" },
    { id: "learn", kind: "human", title: "Learn loop", who: "Owner and Claude",
      what: "When a gate catches something an earlier step should have caught, it goes into factory-learnings.md and becomes a rule in the agent's file." },
  ] },
];
const FLOW_NODES = FLOW.flatMap((p, pi) => p.nodes.map((n) => ({ ...n, phase: p.phase, phaseIndex: pi })));
const flowView = { selected: "gate1", kind: "" };

function flowIssues(node) {
  return state.issues.filter((i) => i.state === "open" && (node.labels || []).some((l) => i.labels.some((x) => x.name === l)));
}

function renderWorkflow() {
  const node = FLOW_NODES.find((n) => n.id === flowView.selected) || FLOW_NODES[0];
  const at = FLOW_NODES.indexOf(node);
  const route = FLOW_NODES.filter((n) => !flowView.kind || n.kind === flowView.kind || n === node);
  const prev = route[route.indexOf(node) - 1];
  const next = route[route.indexOf(node) + 1];
  put("workflow-filter", [
    html`<button type="button" class="chip-btn${flowView.kind ? "" : " on"}" data-act="flow-kind" data-kind="">All steps</button>`,
    Object.entries(KINDS).map(([k, label]) => html`<button type="button" class="chip-btn k-${k}${flowView.kind === k ? " on" : ""}" data-act="flow-kind" data-kind="${k}"><i></i>${label}</button>`),
  ]);
  put("workflow-flow", FLOW.map((p, pi) => html`<div class="phase-col">
    <div class="phase-head"><span class="phase-n">${pi + 1}</span><span>${p.phase}</span></div>
    <div class="phase-file muted">${p.file}</div>
    <ol class="steps-list">${p.nodes.map((n) => {
      const live = flowIssues(n);
      const dim = flowView.kind && flowView.kind !== n.kind;
      return html`<li><button type="button" class="node k-${n.kind}${n.id === node.id ? " on" : ""}${dim ? " dim" : ""}" data-act="flow" data-id="${n.id}" aria-pressed="${n.id === node.id}">
        <i></i><span class="node-title">${n.title}</span>
        ${n.loop ? html`<span class="node-loop" title="${n.loop}">↺</span>` : ""}
        ${live.length ? html`<span class="node-count" title="${live.length} open issue(s) here now">${live.length}</span>` : ""}
      </button></li>`;
    })}</ol>
  </div>`));

  const live = flowIssues(node);
  const md = (t) => new Raw(esc(t).replace(/`([^`]+)`/g, "<code>$1</code>"));
  put("workflow-detail", html`
    <div class="detail-head">
      <span class="kind-pill k-${node.kind}"><i></i>${KINDS[node.kind]}</span>
      <span class="muted small">Step ${at + 1} of ${FLOW_NODES.length} · ${node.phase}</span>
      <span class="spacer"></span>
      <button type="button" class="small" data-act="flow" data-id="${prev?.id || ""}"${prev ? "" : html` disabled`}>Previous</button>
      <button type="button" class="small primary" data-act="flow" data-id="${next?.id || ""}"${next ? "" : html` disabled`}>${flowView.kind ? `Next ${KINDS[flowView.kind].toLowerCase()}` : "Next step"}</button>
    </div>
    <h3 class="detail-title">${node.title}</h3>
    <p class="muted small">${node.who}</p>
    <p>${md(node.what)}</p>
    <dl class="detail-grid">
      ${node.pass ? html`<dt class="ok">Passes when</dt><dd>${md(node.pass)}</dd>` : ""}
      ${node.fail ? html`<dt class="no">Otherwise</dt><dd>${md(node.fail)}</dd>` : ""}
      ${node.loop ? html`<dt class="loop">Retry loop</dt><dd>${md(node.loop)}</dd>` : ""}
      ${node.labels ? html`<dt>Labels</dt><dd>${node.labels.map((l) => html`<code>${l}</code> `)}</dd>` : ""}
      ${node.labels ? html`<dt>Here now</dt><dd>${live.length ? live.map((i) => html`<a href="${i.html_url}" target="_blank" rel="noopener">#${i.number}</a> ${i.title}<br>`) : html`<span class="muted">No open issue.</span>`}</dd>` : ""}
    </dl>`);
}

function selectFlow(id, kind) {
  if (id) flowView.selected = id;
  if (kind !== undefined) {
    flowView.kind = kind;
    const first = kind && FLOW_NODES.find((n) => n.kind === kind);
    if (first && FLOW_NODES.find((n) => n.id === flowView.selected)?.kind !== kind) flowView.selected = first.id;
  }
  renderWorkflow();
  if (id && window.innerWidth < 720) $("workflow-detail").scrollIntoView({ behavior: "smooth", block: "start" });
}

function turnPage(key, to) {
  pages[key] = Math.max(0, to);
  const render = { specs: renderSpecs, runs: renderRuns, cost: renderCost, health: renderHealth }[key];
  Promise.resolve(render()).catch((e) => showBanner(`Could not load: ${e.message}`));
}

// ---------- dialogs and actions ----------

// Opens the shared confirm dialog; resolves with the textarea value (or true) on OK, null on cancel.
function confirmDialog({ title, content, okLabel, needText = false, ack = "", run }) {
  const dlg = $("confirm-dialog");
  $("confirm-title").textContent = title;
  put("confirm-content", content);
  $("confirm-ok").textContent = okLabel;
  $("confirm-text").hidden = !needText;
  $("confirm-text").value = "";
  $("confirm-ack-wrap").hidden = !ack;
  $("confirm-ack-label").textContent = ack;
  $("confirm-ack").checked = false;
  $("confirm-error").hidden = true;
  const sync = () => {
    $("confirm-ok").disabled = (ack && !$("confirm-ack").checked) || (needText && !$("confirm-text").value.trim());
  };
  $("confirm-ack").onchange = sync;
  $("confirm-text").oninput = sync;
  sync();
  $("confirm-ok").onclick = async (ev) => {
    ev.preventDefault();
    $("confirm-ok").disabled = true;
    try {
      await run($("confirm-text").value.trim());
      dlg.close();
      load();
    } catch (e) {
      $("confirm-error").textContent = e.message;
      $("confirm-error").hidden = false;
      sync();
    }
  };
  if (!dlg.open) dlg.showModal();
}

function labelAction(n, label) {
  const issue = state.byNumber.get(n);
  const effect = label === "build-now" ? "Factory 3 starts building this issue now." : "Factory 1 starts writing a spec for this issue.";
  confirmDialog({
    title: `Add label ${label}`,
    content: html`<p><strong>#${n}</strong> ${issue ? issue.title : ""}</p><p>${effect}</p>`,
    okLabel: `Add ${label}`,
    run: () => gh(`/repos/${REPO}/issues/${n}/labels`, { method: "POST", body: { labels: [label] } }),
  });
}

function commentAction(n) {
  const item = state.byNumber.get(n);
  confirmDialog({
    title: `Comment on #${n}`,
    content: html`<p>${item ? item.title : ""}</p><p class="small muted">Posted as you. Mentioning @claude starts the on-demand agent.</p>`,
    okLabel: "Post comment",
    needText: true,
    run: (text) => gh(`/repos/${REPO}/issues/${n}/comments`, { method: "POST", body: { body: text } }),
  });
}

function rerunAction(id, name) {
  confirmDialog({
    title: "Re-run failed jobs",
    content: html`<p>${name}, run <a href="${ghUrl(`actions/runs/${id}`)}" target="_blank" rel="noopener">${id}</a>.</p>`,
    okLabel: "Re-run",
    run: () => gh(`/repos/${REPO}/actions/runs/${id}/rerun-failed-jobs`, { method: "POST" }),
  });
}

// Renders the PR body's markdown evidence table (or the first lines of the body) as escaped HTML.
function evidence(body) {
  const lines = (body || "").split("\n");
  const start = lines.findIndex((l) => /^##\s+Evidence/i.test(l));
  const table = (start >= 0 ? lines.slice(start + 1) : lines).filter((l) => l.trim().startsWith("|"));
  if (start >= 0 && table.length) {
    const rows = table.filter((l) => !/^\|\s*-/.test(l.trim())).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    const cell = (c) => new Raw(esc(c).replace(/https:\/\/github\.com\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.split("/").pop()}</a>`));
    return html`<table><thead><tr>${rows[0].map((c) => html`<th>${c}</th>`)}</tr></thead>
      <tbody>${rows.slice(1).map((r) => html`<tr>${r.map((c) => html`<td class="wrap">${cell(c)}</td>`)}</tr>`)}</tbody></table>`;
  }
  return html`<div class="pre">${(body || "No description.").slice(0, 1500)}</div>`;
}

let mergeSeq = 0;
async function mergeAction(n) {
  const seq = ++mergeSeq;
  confirmDialog({ title: `Merge #${n}`, content: html`<p class="muted">Loading PR, evidence and CI…</p>`, okLabel: "Squash and merge", ack: "I have read the evidence and CI results and approve this merge.", run: async () => { throw new Error("Still loading"); } });
  try {
    const pr = await gh(`/repos/${REPO}/pulls/${n}`);
    const [checkRuns, combined, prComments] = await Promise.all([
      gh(`/repos/${REPO}/commits/${pr.head.sha}/check-runs?per_page=100`),
      gh(`/repos/${REPO}/commits/${pr.head.sha}/status`),
      gh(`/repos/${REPO}/issues/${n}/comments?per_page=100`),
    ]);
    // Commit statuses (such as factory/review) are listed with the check runs.
    const checks = [...checkRuns.check_runs, ...combined.statuses.map((st) => ({
      name: st.context,
      status: st.state === "pending" ? "in_progress" : "completed",
      conclusion: st.state === "error" ? "failure" : st.state,
      description: st.description,
    }))];
    const review = prComments.map(parseReview).filter(Boolean).pop() || null;
    const reviewBad = !review || review.verdict !== "looks-good";
    const allGreen = checks.length > 0 && checks.every((c) => c.status === "completed" && ["success", "skipped", "neutral"].includes(c.conclusion));
    const ciRows = checks.map((c) => {
      const st = c.status === "completed" ? c.conclusion : c.status;
      return html`<tr><td>${c.name}</td><td class="st-${st}">${st}</td><td class="wrap muted">${c.description || ""}</td></tr>`;
    });
    if (seq !== mergeSeq || !$("confirm-dialog").open) return;
    const blocked = pr.state !== "open" || pr.mergeable === false;
    confirmDialog({
      title: `Merge #${n}: ${pr.title}`,
      content: html`
        <p><a href="${pr.html_url}" target="_blank" rel="noopener">Open on GitHub</a> · ${pr.head.ref} → ${pr.base.ref} · ${pr.changed_files} files, +${pr.additions} −${pr.deletions}</p>
        <h3>Evidence</h3>
        <div class="table-wrap">${evidence(pr.body)}</div>
        <h3>AI review</h3>
        ${review ? html`<p><span class="verdict ${review.verdict === "looks-good" ? "good" : "bad"}">${review.verdict}</span> ${review.findings} findings · <a href="${review.url}" target="_blank" rel="noopener">${age(review.at)} ago</a></p>
          <div class="pre">${review.body.slice(0, 2500)}</div>` : html`<p class="warn">No AI review comment found.</p>`}
        ${reviewBad ? html`<p class="warn">The AI reviewer did not say "looks good". Merging overrides it.</p>` : ""}
        <h3>CI</h3>
        ${checks.length ? html`<div class="table-wrap"><table><tbody>${ciRows}</tbody></table></div>` : html`<p class="warn">No CI checks found on the head commit.</p>`}
        ${allGreen ? "" : html`<p class="warn">CI is not fully green.</p>`}
        ${blocked ? html`<p class="warn">GitHub reports this PR is not mergeable (${pr.state}, ${pr.mergeable_state}).</p>` : ""}
        <p class="small muted">Squash merge of head ${pr.head.sha.slice(0, 7)}. Merging is the human gate.</p>`,
      okLabel: `Squash and merge #${n}`,
      ack: reviewBad
        ? "I have read the evidence, the CI results and the AI review findings, and approve this merge anyway."
        : "I have read the evidence and CI results and approve this merge.",
      run: () => gh(`/repos/${REPO}/pulls/${n}/merge`, { method: "PUT", body: { merge_method: "squash", sha: pr.head.sha } }),
    });
  } catch (e) {
    $("confirm-error").textContent = e.message;
    $("confirm-error").hidden = false;
  }
}

// ---------- token ----------

async function openToken() {
  const dlg = $("token-dialog");
  $("token-input").value = "";
  $("token-forget").hidden = !getToken();
  $("token-who").textContent = getToken() ? "A token is stored. Checking…" : "No token stored: read-only, 60 API calls per hour.";
  dlg.showModal();
  if (getToken()) {
    try { $("token-who").textContent = `Signed in as ${(await gh("/user")).login}.`; } catch (e) { $("token-who").textContent = `Stored token fails: ${e.message}`; }
  }
}

$("token-dialog").addEventListener("close", () => {
  const choice = $("token-dialog").returnValue;
  if (choice === "save" && $("token-input").value.trim()) setToken($("token-input").value.trim());
  else if (choice === "forget") setToken("");
  else return;
  updateTokenButton();
  load();
});

function updateTokenButton() {
  $("token-btn").textContent = getToken() ? "Token ✓" : "Add token";
  $("token-btn").classList.toggle("primary", !getToken());
}

// ---------- wiring ----------

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-act]");
  if (!btn) return;
  const n = Number(btn.dataset.n);
  if (btn.dataset.act === "label") labelAction(n, btn.dataset.label);
  else if (btn.dataset.act === "comment") commentAction(n);
  else if (btn.dataset.act === "merge") mergeAction(n);
  else if (btn.dataset.act === "issue") issueDetail(n);
  else if (btn.dataset.act === "flow") selectFlow(btn.dataset.id);
  else if (btn.dataset.act === "flow-kind") selectFlow(null, btn.dataset.kind);
  else if (btn.dataset.act === "page") turnPage(btn.dataset.key, Number(btn.dataset.to));
  else if (btn.dataset.act === "rerun") rerunAction(Number(btn.dataset.run), btn.dataset.name);
});
document.addEventListener("click", (ev) => {
  const row = ev.target.closest("tr[data-issue]");
  if (row && !ev.target.closest("a, button")) issueDetail(Number(row.dataset.issue));
});
$("token-input").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") { ev.preventDefault(); $("token-dialog").close("save"); }
});
$("refresh").addEventListener("click", load);
function markTab() {
  const current = location.hash || "#board";
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("current", a.getAttribute("href") === current));
}
window.addEventListener("hashchange", markTab);
markTab();
$("token-btn").addEventListener("click", openToken);
$("repo-link").textContent = REPO;
$("repo-link").href = `https://github.com/${REPO}`;

updateTokenButton();
renderWorkflow();
load();
setInterval(() => { if (getToken() && !document.hidden && !$("confirm-dialog").open && !$("issue-dialog").open) load(); }, 120000);
