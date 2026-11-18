import { createHash } from "node:crypto";
import { categorize, type Category } from "@fg/shared";
import { addDays, dateKey, isWeekend, localDate, localMinuteOfDay, MINUTE, zonedToUtc, type LocalDate } from "./time.ts";

export const STAGES = ["empty", "onboarded", "week", "rules-applied", "alerts"] as const;
export type Stage = (typeof STAGES)[number];

export const TIMEZONE = "Asia/Ho_Chi_Minh";
export const E2E_EMAIL_DOMAIN = "e2e.family-guardian.test";

/** Deterministic UUID so a re-seed writes the same ids and screenshots link to the same pages. */
export function stableId(name: string): string {
  const h = createHash("sha256").update(`family-guardian-e2e:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const MIA = stableId("child:mia");
export const LEO = stableId("child:leo");
export const NOAH = stableId("child:noah");
const MIA_LAPTOP = stableId("device:mia-laptop");
const FAMILY_PC = stableId("device:family-pc");
const LEO_LAPTOP = stableId("device:leo-laptop");

export type ChildRow = {
  id: string;
  name: string;
  homework_categories: Category[];
  homework_domains: string[];
  allowed_start: string | null;
  allowed_end: string | null;
};
export type DeviceRow = {
  id: string;
  child_id: string;
  token_hash: string;
  browser: "chrome" | "edge" | "brave";
  os: string;
  name: string;
  extension_version: string;
  last_seen_at: string | null;
  created_at: string;
};
export type UsageRow = { device_id: string; minute_utc: string; domain: string; seconds: number };
export type BlockRuleRow = { id: string; child_id: string; kind: "domain" | "category"; value: string; created_at: string };
export type BlockEventRow = { device_id: string; at: string; domain: string };
export type CategoryLimitRow = { child_id: string; category: Category; minutes_per_day: number };
export type CategoryOverrideRow = { domain: string; category: Category };
export type AlertRow = {
  id: string;
  device_id: string;
  kind: "offline";
  sent_at: string;
  incident_last_seen_at: string;
  emailed_at: string;
};

export type Fixture = {
  stage: Stage;
  parent: { email: string; fullName: string };
  family: {
    name: string;
    timezone: string;
    timezone_known: boolean;
    digest_frequency: "daily" | "weekly";
    digest_hour: number;
    weekly_report_enabled: boolean;
  };
  children: ChildRow[];
  devices: DeviceRow[];
  usage: UsageRow[];
  blockRules: BlockRuleRow[];
  blockEvents: BlockEventRow[];
  categoryLimits: CategoryLimitRow[];
  categoryOverrides: CategoryOverrideRow[];
  alerts: AlertRow[];
};

type Mix = readonly (readonly [domain: string, weight: number])[];
type Block = { at: readonly [hour: number, minute: number]; minutes: number; device: string; mix: Mix; stickiness: number };
type Persona = { child: string; schoolDay: readonly Block[]; weekend: readonly Block[] };

// Registrable domains only, as the extension reports them (ADR 0005).
const MIA_HOMEWORK: Mix = [["khanacademy.org", 4], ["wikipedia.org", 3], ["quizlet.com", 2], ["code.org", 2], ["youtube.com", 1]];
const LEO_HOMEWORK: Mix = [["khanacademy.org", 4], ["mathplayground.com", 2], ["youtube.com", 2], ["tiktok.com", 2], ["coolmathgames.com", 1]];
const PERSONAS: readonly Persona[] = [
  {
    child: MIA,
    schoolDay: [
      { at: [6, 45], minutes: 15, device: MIA_LAPTOP, mix: [["duolingo.com", 1]], stickiness: 1 },
      { at: [15, 30], minutes: 90, device: MIA_LAPTOP, mix: MIA_HOMEWORK, stickiness: 0.88 },
      { at: [19, 30], minutes: 30, device: MIA_LAPTOP, mix: [["youtube.com", 3], ["spotify.com", 1]], stickiness: 0.9 },
    ],
    weekend: [
      { at: [9, 30], minutes: 75, device: FAMILY_PC, mix: MIA_HOMEWORK, stickiness: 0.88 },
      { at: [14, 0], minutes: 75, device: FAMILY_PC, mix: [["netflix.com", 2], ["youtube.com", 2], ["minecraft.net", 1]], stickiness: 0.9 },
    ],
  },
  {
    child: LEO,
    schoolDay: [
      { at: [7, 0], minutes: 20, device: LEO_LAPTOP, mix: [["youtube.com", 2], ["roblox.com", 1]], stickiness: 0.8 },
      {
        at: [16, 0],
        minutes: 90,
        device: LEO_LAPTOP,
        mix: LEO_HOMEWORK,
        stickiness: 0.75,
      },
      { at: [18, 30], minutes: 90, device: LEO_LAPTOP, mix: [["roblox.com", 3], ["minecraft.net", 1], ["poki.com", 1]], stickiness: 0.9 },
      { at: [20, 15], minutes: 45, device: LEO_LAPTOP, mix: [["tiktok.com", 2], ["youtube.com", 2], ["instagram.com", 1]], stickiness: 0.8 },
    ],
    weekend: [
      { at: [9, 0], minutes: 150, device: LEO_LAPTOP, mix: [["roblox.com", 3], ["youtube.com", 2], ["poki.com", 1]], stickiness: 0.85 },
      { at: [11, 30], minutes: 40, device: LEO_LAPTOP, mix: LEO_HOMEWORK, stickiness: 0.75 },
      { at: [15, 0], minutes: 60, device: LEO_LAPTOP, mix: [["tiktok.com", 2], ["instagram.com", 1], ["youtube.com", 1]], stickiness: 0.8 },
      { at: [20, 30], minutes: 60, device: LEO_LAPTOP, mix: [["youtube.com", 1], ["roblox.com", 1]], stickiness: 0.85 },
    ],
  },
];

const OVERRIDES: readonly CategoryOverrideRow[] = [
  { domain: "mathplayground.com", category: "education" },
  { domain: "coolmathgames.com", category: "games" },
];
const OVERRIDE_MAP: Readonly<Record<string, Category>> = Object.fromEntries(OVERRIDES.map((o) => [o.domain, o.category]));

/** mulberry32: small seeded PRNG so every run produces the same week. */
function rng(seed: string): () => number {
  let a = createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(mix: Mix, r: number): string {
  const total = mix.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [domain, w] of mix) {
    x -= w;
    if (x < 0) return domain;
  }
  return mix[mix.length - 1][0];
}

const iso = (ms: number) => new Date(ms).toISOString();
const atStage = (stage: Stage, from: Stage) => STAGES.indexOf(stage) >= STAGES.indexOf(from);

function dayUsage(persona: Persona, day: LocalDate, nowMs: number): UsageRow[] {
  const random = rng(`${persona.child}:${dateKey(day)}`);
  const rows: UsageRow[] = [];
  for (const block of isWeekend(day) ? persona.weekend : persona.schoolDay) {
    const start = zonedToUtc(day, block.at[0], block.at[1], TIMEZONE);
    let domain = pick(block.mix, random());
    for (let i = 0; i < block.minutes; i++) {
      const idle = random() < 0.08;
      if (random() > block.stickiness) domain = pick(block.mix, random());
      const seconds = 35 + Math.floor(random() * 26);
      const t = start + i * MINUTE;
      if (idle || t > nowMs) continue;
      rows.push({ device_id: block.device, minute_utc: iso(t), domain, seconds });
    }
  }
  return rows;
}

type RuleWindow = { blockFrom: number; hoursFrom: number };

/** What Leo's extension would have let through once the parent added rules; blocked run starts become events. */
function applyLeoRules(rows: UsageRow[], w: RuleWindow): { kept: UsageRow[]; events: BlockEventRow[] } {
  const kept: UsageRow[] = [];
  const events: BlockEventRow[] = [];
  const gamesByDay = new Map<string, number>();
  let lastBlocked: string | null = null;
  for (const row of rows) {
    const t = Date.parse(row.minute_utc);
    const category = categorize(row.domain, OVERRIDE_MAP);
    const day = dateKey(localDate(t, TIMEZONE));
    const minute = localMinuteOfDay(t, TIMEZONE);
    let blocked = false;
    if (t >= w.hoursFrom && (minute < 7 * 60 || minute >= 20 * 60)) {
      lastBlocked = null;
      continue;
    }
    if (t >= w.blockFrom && (row.domain === "tiktok.com" || category === "social")) blocked = true;
    if (!blocked && t >= w.blockFrom && category === "games") {
      const used = gamesByDay.get(day) ?? 0;
      if (used + row.seconds > 3600) blocked = true;
      else gamesByDay.set(day, used + row.seconds);
    }
    if (blocked) {
      if (lastBlocked !== row.domain) events.push({ device_id: row.device_id, at: row.minute_utc, domain: row.domain });
      lastBlocked = row.domain;
      continue;
    }
    lastBlocked = null;
    kept.push(row);
  }
  return { kept, events };
}

export function generate(stage: Stage, now: Date = new Date()): Fixture {
  const nowMs = Math.floor(now.getTime() / MINUTE) * MINUTE;
  const today = localDate(nowMs, TIMEZONE);
  const startOfDay = (offset: number) => zonedToUtc(addDays(today, offset), 0, 0, TIMEZONE);
  const window: RuleWindow = { blockFrom: startOfDay(-3), hoursFrom: startOfDay(-1) };
  const rules = atStage(stage, "rules-applied");
  const recentlySeen = iso(nowMs - 2 * MINUTE);
  const familyPcLastSeen = nowMs - 3 * 24 * 60 * MINUTE - 10 * MINUTE;

  const fixture: Fixture = {
    stage,
    parent: { email: `parent@${E2E_EMAIL_DOMAIN}`, fullName: "Alex Parker" },
    family: {
      name: "Parker family",
      timezone: TIMEZONE,
      timezone_known: true,
      digest_frequency: "daily",
      digest_hour: 8,
      weekly_report_enabled: true,
    },
    children: [],
    devices: [],
    usage: [],
    blockRules: [],
    blockEvents: [],
    categoryLimits: [],
    categoryOverrides: [],
    alerts: [],
  };
  if (stage === "empty") return fixture;

  fixture.children = [
    { id: MIA, name: "Mia", homework_categories: ["education", "productivity"], homework_domains: [], allowed_start: null, allowed_end: null },
    {
      id: LEO,
      name: "Leo",
      homework_categories: ["education"],
      homework_domains: ["mathplayground.com"],
      allowed_start: rules ? "07:00" : null,
      allowed_end: rules ? "20:00" : null,
    },
    { id: NOAH, name: "Noah", homework_categories: ["education"], homework_domains: [], allowed_start: null, allowed_end: null },
  ];
  const device = (id: string, child: string, browser: DeviceRow["browser"], name: string): DeviceRow => ({
    id,
    child_id: child,
    token_hash: createHash("sha256").update(`e2e-token:${id}`).digest("hex"),
    browser,
    os: "Windows",
    name,
    extension_version: "0.3.0",
    last_seen_at: recentlySeen,
    created_at: iso(startOfDay(-14)),
  });
  fixture.devices = [
    device(MIA_LAPTOP, MIA, "chrome", "Mia's laptop"),
    device(FAMILY_PC, MIA, "edge", "Family PC"),
    device(LEO_LAPTOP, LEO, "brave", "Leo's laptop"),
  ];
  if (stage === "onboarded") return fixture;

  fixture.categoryOverrides = [...OVERRIDES];
  for (const persona of PERSONAS) {
    let rows: UsageRow[] = [];
    for (let offset = -6; offset <= 0; offset++) rows.push(...dayUsage(persona, addDays(today, offset), nowMs));
    if (rules && persona.child === LEO) {
      const applied = applyLeoRules(rows, window);
      rows = applied.kept;
      fixture.blockEvents.push(...applied.events);
    }
    fixture.usage.push(...rows);
  }
  if (!rules) return fixture;

  fixture.blockRules = [
    { id: stableId("rule:leo-tiktok"), child_id: LEO, kind: "domain", value: "tiktok.com", created_at: iso(window.blockFrom) },
    { id: stableId("rule:leo-social"), child_id: LEO, kind: "category", value: "social", created_at: iso(window.blockFrom) },
  ];
  fixture.categoryLimits = [
    { child_id: LEO, category: "games", minutes_per_day: 60 },
    { child_id: MIA, category: "entertainment", minutes_per_day: 90 },
  ];
  if (stage === "rules-applied") return fixture;

  const pc = fixture.devices.find((d) => d.id === FAMILY_PC);
  if (pc) pc.last_seen_at = iso(familyPcLastSeen);
  fixture.usage = fixture.usage.filter((u) => u.device_id !== FAMILY_PC || Date.parse(u.minute_utc) <= familyPcLastSeen);
  const sent = iso(familyPcLastSeen + 35 * MINUTE);
  fixture.alerts = [
    { id: stableId("alert:family-pc"), device_id: FAMILY_PC, kind: "offline", sent_at: sent, incident_last_seen_at: iso(familyPcLastSeen), emailed_at: sent },
  ];
  return fixture;
}
