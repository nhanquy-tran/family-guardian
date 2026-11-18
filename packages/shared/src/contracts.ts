import { z } from "zod";
import { CATEGORIES } from "./categories";

export const MAX_HEARTBEAT_ENTRIES = 1440;
export const MAX_BLOCKED_ATTEMPTS = 1000;
export const MAX_RULE_DOMAINS = 5000;

export const UsageEntry = z.object({
  minuteUtc: z.iso.datetime(),
  domain: z.string().min(1).max(253),
  seconds: z.number().int().min(1).max(60),
});

export const BlockedAttempt = z.object({
  at: z.iso.datetime(),
  domain: z.string().min(1).max(253),
});

export const HeartbeatRequest = z.object({
  entries: z.array(UsageEntry).max(MAX_HEARTBEAT_ENTRIES),
  currentDomain: z.string().max(253).nullable(),
  browser: z.enum(["chrome", "edge", "brave", "other"]),
  extensionVersion: z.string().max(32),
  blocked: z.array(BlockedAttempt).max(MAX_BLOCKED_ATTEMPTS).optional(),
});

export const HeartbeatEnvelope = z.object({
  entries: z.array(z.unknown()),
  currentDomain: z.string().max(253).nullable(),
  browser: z.enum(["chrome", "edge", "brave", "other"]),
  extensionVersion: z.string().max(32),
  blocked: z.array(z.unknown()).optional(),
});

export const HeartbeatResponse = z.object({
  rulesVersion: z.number().int().nonnegative(),
});

export const RulesResponse = z.object({
  rulesVersion: z.number().int().nonnegative(),
  domains: z.array(z.string()).max(MAX_RULE_DOMAINS),
  truncated: z.boolean(),
  limits: z
    .array(z.object({ category: z.enum(CATEGORIES), minutesPerDay: z.number().int().min(5).max(1440) }))
    .max(CATEGORIES.length)
    .refine((l) => new Set(l.map((x) => x.category)).size === l.length)
    .default([]),
  timezone: z.string().min(1).max(64).optional(),
  categoryOverrides: z
    .record(z.string().max(253), z.enum(CATEGORIES))
    .refine((m) => Object.keys(m).length <= MAX_RULE_DOMAINS)
    .default({}),
});

export type RulesResponse = z.infer<typeof RulesResponse>;
export type BlockedAttempt = z.infer<typeof BlockedAttempt>;
export type UsageEntry = z.infer<typeof UsageEntry>;
export type HeartbeatRequest = z.infer<typeof HeartbeatRequest>;
export type HeartbeatResponse = z.infer<typeof HeartbeatResponse>;
