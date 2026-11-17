"use strict";

const REPO_PARAM = new URLSearchParams(location.search).get("repo") || "";
const REPO = /^[\w.-]+\/[\w.-]+$/.test(REPO_PARAM) ? REPO_PARAM : "nhanquy-tran/family-guardian";
const API = "https://api.github.com";
const TOKEN_KEY = "factory-dashboard-token";
const COLUMNS = ["needs-spec", "spec-in-progress", "spec-review", "ready", "in-progress", "in-review", "needs-human"];
const AGENT_WORKFLOWS = /^Factory [134]:/;
const SHOWN_WORKFLOWS = /^(Factory [134]:|CI$)/;
const AGENTS = ["spec-writer", "test-writer", "developer", "reviewer"];
const TRUSTED_AUTHORS = ["OWNER", "MEMBER", "COLLABORATOR"];

const FACTORY_AUTHORS = ["claude[bot]", "family-guardian-factory"];

const state = { issues: [], pulls: [], runs: [], metrics: [], reviews: new Map(), linked: new Map(), byNumber: new Map() };
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
  if (c.user?.login !== "github-actions[bot]" || !/Verdict:|factory-review/.test(c.body || "")) return null;
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
    const [items, pulls, runs, comments] = await Promise.all([
      ghPages(`/repos/${REPO}/issues?state=all`, 3),
      ghPages(`/repos/${REPO}/pulls?state=all`, 2),
      gh(`/repos/${REPO}/actions/runs?per_page=100`).then((r) => r.workflow_runs),
      ghPages(`/repos/${REPO}/issues/comments?sort=created&direction=desc`, 3),
    ]);
    state.issues = items.filter((i) => !i.pull_request);
    state.byNumber = new Map(items.map((i) => [i.number, i]));
    state.pulls = pulls;
    state.runs = runs.filter((r) => SHOWN_WORKFLOWS.test(r.name) && r.conclusion !== "skipped");
    state.metrics = parseMetrics(comments);
    state.reviews = parseReviews(comments);
    linkPulls();
    renderBoard();
    renderRuns();
    renderCost();
    $("status").textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    await renderSpecs();
    await renderHealth();
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
  const specPrs = state.pulls.filter((p) => p.labels.some((l) => l.name === "spec") && (p.state === "open" || p.merged_at)).slice(0, 15);
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

  const linkedFolders = new Set(rows.map((r) => r.folder));
  for (const name of activeNames.filter((n) => !linkedFolders.has(n))) {
    rows.push({ pr: null, folder: name, issueNo: null, where: "main", progress: await readTasks(name, null) });
  }

  put("specs-body", rows.length ? html`<table>
    <thead><tr><th>PR</th><th>Issue</th><th>Change</th><th>Tasks</th><th>Read from</th><th></th></tr></thead>
    <tbody>${rows.map(specRow)}</tbody></table>` : html`<p class="muted">No spec PRs yet.</p>`);
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
  put("runs-body", html`<table>
    <thead><tr><th>Workflow</th><th>Branch</th><th>Event</th><th>Result</th><th>Started</th><th class="num">Duration</th><th class="num">Cost</th><th></th></tr></thead>
    <tbody>${state.runs.slice(0, 40).map((r) => {
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
    })}</tbody></table>`);
}

function tile(value, label) {
  return html`<div class="tile"><div class="v">${value}</div><div class="l">${label}</div></div>`;
}

// ---------- cost ----------

function renderCost() {
  const ms = state.metrics;
  const total = (list) => list.reduce((s, m) => s + (m.cost_usd || 0), 0);
  const since = (from) => ms.filter((m) => Date.parse(m.at) >= from);
  put("cost-tiles", [
    tile(money(total(since(startOfToday()))), "today"),
    tile(money(total(since(startOfWeek()))), "this week"),
    tile(money(total(ms)), "total"),
    tile(String(ms.length), "agent steps measured"),
  ]);
  if (!ms.length) {
    put("cost-issues", html`<p class="muted">No metrics yet. They appear after the next factory run that includes the metrics step.</p>`);
    put("cost-runs", "");
    return;
  }

  const perIssue = new Map();
  for (const m of ms) {
    const n = issueOf(m.target);
    const row = perIssue.get(n) || { n, agents: {}, turns: 0, cost: 0 };
    row.agents[m.agent] = (row.agents[m.agent] || 0) + (m.cost_usd || 0);
    row.turns += m.turns || 0;
    row.cost += m.cost_usd || 0;
    perIssue.set(n, row);
  }
  put("cost-issues", html`<table>
    <thead><tr><th>Issue</th>${AGENTS.map((a) => html`<th class="num">${a}</th>`)}<th class="num">Turns</th><th class="num">Total</th></tr></thead>
    <tbody>${[...perIssue.values()].sort((a, b) => b.n - a.n).map((r) => {
      const issue = state.byNumber.get(r.n);
      return html`<tr>
        <td class="wrap"><a href="${ghUrl(`issues/${r.n}`)}" target="_blank" rel="noopener">#${r.n}</a> ${issue ? issue.title : ""}</td>
        ${AGENTS.map((a) => html`<td class="num">${r.agents[a] ? money(r.agents[a]) : ""}</td>`)}
        <td class="num">${r.turns}</td><td class="num"><strong>${money(r.cost)}</strong></td>
      </tr>`;
    })}</tbody></table>`);

  const perRun = new Map();
  for (const m of ms) {
    const row = perRun.get(m.run_id) || { id: m.run_id, workflow: m.workflow, n: issueOf(m.target), at: m.at, agents: [], turns: 0, cost: 0, ms: 0 };
    row.agents.push(m.agent);
    row.turns += m.turns || 0;
    row.cost += m.cost_usd || 0;
    row.ms += m.duration_ms || 0;
    perRun.set(m.run_id, row);
  }
  put("cost-runs", html`<table>
    <thead><tr><th>Run</th><th>Workflow</th><th>Issue</th><th>Agents</th><th class="num">Turns</th><th class="num">Agent time</th><th class="num">Cost</th></tr></thead>
    <tbody>${[...perRun.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((r) => html`<tr>
      <td><a href="${ghUrl(`actions/runs/${r.id}`)}" target="_blank" rel="noopener">${r.id}</a> <span class="muted">${age(r.at)} ago</span></td>
      <td>${r.workflow}</td><td>#${r.n}</td><td>${r.agents.join(", ")}</td>
      <td class="num">${r.turns}</td><td class="num">${duration(r.ms)}</td><td class="num">${money(r.cost)}</td>
    </tr>`)}</tbody></table>`);
}

// ---------- factory health ----------

function median(xs) {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
}
const span = (ms) => (ms === null || ms === undefined ? "—" : duration(ms));
const between = (a, b) => (a && b ? Math.max(0, Date.parse(b) - Date.parse(a)) : null);

// Fix-up commits on a factory PR (human or @claude); 0 means the PR went through on the first pass.
// The Claude action commits as claude[bot] for both the factory and @claude, so the factory's commits are
// recognised by count: one on a spec PR, test + implementation on a build PR.
async function humanCommits(pr) {
  const commits = await ghBySha(`commits:${pr.number}:${pr.head.sha}`, `/repos/${REPO}/pulls/${pr.number}/commits?per_page=100`);
  const expected = pr.head.ref.startsWith("spec/") ? 1 : 2;
  const byOthers = commits.filter((c) => !FACTORY_AUTHORS.includes(c.commit.author?.name)).length;
  return Math.max(commits.length - expected, byOthers);
}

async function renderHealth() {
  const rows = [];
  for (const [n, prs] of state.linked) {
    if (!prs.spec) continue;
    const factory = prs.factory;
    const ms = state.metrics.filter((m) => issueOf(m.target) === n);
    rows.push({
      n,
      reviewed: [prs.spec, factory].filter(Boolean).map((pr) => ({ pr, review: reviewAt(pr.number, pr.merged_at) })),
      cost: ms.length ? ms.reduce((s, m) => s + (m.cost_usd || 0), 0) : null,
      agentMs: ms.length ? ms.reduce((s, m) => s + (m.duration_ms || 0), 0) : null,
      specWait: between(prs.spec.created_at, prs.spec.merged_at),
      queue: factory ? between(prs.spec.merged_at, factory.created_at) : null,
      buildWait: factory ? between(factory.created_at, factory.merged_at) : null,
      lead: factory ? between(prs.spec.created_at, factory.merged_at) : null,
    });
  }
  const merged = rows.flatMap((r) => r.reviewed.map((x) => x.pr)).filter((pr) => pr.merged_at).slice(0, 16);
  const edits = new Map(await Promise.all(merged.map(async (pr) => [pr.number, await humanCommits(pr).catch(() => null)])));
  const known = merged.filter((pr) => edits.get(pr.number) !== null);
  const firstPass = known.filter((pr) => edits.get(pr.number) === 0).length;
  const mergedReviews = merged.map((pr) => reviewAt(pr.number, pr.merged_at)).filter(Boolean);
  const overridden = mergedReviews.filter((r) => r.verdict === "changes-needed").length;
  const allReviews = rows.flatMap((r) => r.reviewed.map((x) => x.review)).filter(Boolean);
  const done = rows.filter((r) => r.lead !== null);
  const costed = done.filter((r) => r.cost !== null);
  const timed = done.filter((r) => r.agentMs !== null);
  const timedLead = timed.reduce((s, r) => s + r.lead, 0);

  put("health-tiles", [
    tile(known.length ? `${firstPass}/${known.length}` : "—", "merged PRs with no human commits"),
    tile(`${overridden}/${mergedReviews.length}`, "merged over an AI \"changes needed\""),
    tile(allReviews.length ? (allReviews.reduce((s, r) => s + r.findings, 0) / allReviews.length).toFixed(1) : "—", "AI review findings per PR"),
    tile(costed.length ? money(costed.reduce((s, r) => s + r.cost, 0) / costed.length) : "—", "cost per merged issue"),
    tile(span(median(done.map((r) => r.lead))), "median lead time, spec PR to build merged"),
    tile(timedLead ? `${Math.round((timed.reduce((s, r) => s + r.agentMs, 0) / timedLead) * 100)}%` : "—", "share of lead time spent by agents"),
  ]);

  const prCell = (x) => {
    if (!x) return "";
    const edited = edits.get(x.pr.number);
    const v = x.review?.verdict;
    return html`<a href="${x.pr.html_url}" target="_blank" rel="noopener">#${x.pr.number}</a>${x.review
      ? html`<span class="verdict ${v === "looks-good" ? "good" : "bad"}" title="${x.review.findings} findings">${v === "looks-good" ? "ok" : v === "changes-needed" ? "changes" : "?"}</span>` : ""}${edited
      ? html` <span class="muted" title="Commits not made by the factory">+${edited} human</span>` : ""}`;
  };
  put("health-issues", rows.length ? html`<table>
    <thead><tr><th>Issue</th><th>Spec PR</th><th>Build PR</th><th class="num">Spec review wait</th><th class="num">Queue</th><th class="num">Build review wait</th><th class="num">Lead time</th><th class="num">Agent time</th><th class="num">Cost</th></tr></thead>
    <tbody>${rows.sort((a, b) => b.n - a.n).map((r) => html`<tr>
      <td class="wrap"><a href="${ghUrl(`issues/${r.n}`)}" target="_blank" rel="noopener">#${r.n}</a> ${state.byNumber.get(r.n)?.title || ""}</td>
      <td>${prCell(r.reviewed[0])}</td><td>${prCell(r.reviewed[1])}</td>
      <td class="num">${span(r.specWait)}</td><td class="num">${span(r.queue)}</td><td class="num">${span(r.buildWait)}</td>
      <td class="num"><strong>${span(r.lead)}</strong></td><td class="num">${span(r.agentMs)}</td><td class="num">${r.cost === null ? "—" : money(r.cost)}</td>
    </tr>`)}</tbody></table>` : html`<p class="muted">No issue has a spec PR yet.</p>`);

  const denied = new Map();
  for (const m of state.metrics) {
    for (const call of m.denied || []) {
      const key = JSON.stringify([m.agent, call]);
      denied.set(key, (denied.get(key) || 0) + 1);
    }
  }
  put("health-denied", denied.size ? html`<table>
    <thead><tr><th>Agent</th><th>Denied tool call</th><th class="num">Count</th></tr></thead>
    <tbody>${[...denied].sort((a, b) => b[1] - a[1]).map(([key, count]) => {
      const [agent, call] = JSON.parse(key);
      return html`<tr><td>${agent}</td><td class="wrap"><code>${call}</code></td><td class="num">${count}</td></tr>`;
    })}</tbody></table>`
    : html`<p class="muted">None recorded yet. The metrics step logs them from now on; widen an agent's allowlist when one keeps coming back.</p>`);
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
}

// ---------- wiring ----------

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-act]");
  if (!btn) return;
  const n = Number(btn.dataset.n);
  if (btn.dataset.act === "label") labelAction(n, btn.dataset.label);
  else if (btn.dataset.act === "comment") commentAction(n);
  else if (btn.dataset.act === "merge") mergeAction(n);
  else if (btn.dataset.act === "rerun") rerunAction(Number(btn.dataset.run), btn.dataset.name);
});
$("token-input").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") { ev.preventDefault(); $("token-dialog").close("save"); }
});
$("refresh").addEventListener("click", load);
$("token-btn").addEventListener("click", openToken);
$("repo-link").textContent = REPO;
$("repo-link").href = `https://github.com/${REPO}`;

updateTokenButton();
load();
setInterval(() => { if (getToken() && !document.hidden && !$("confirm-dialog").open) load(); }, 120000);
