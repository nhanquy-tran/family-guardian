import { z } from "zod";

export const MAX_HEARTBEAT_ENTRIES = 1440;

export const UsageEntry = z.object({
  minuteUtc: z.iso.datetime(),
  domain: z.string().min(1).max(253),
  seconds: z.number().int().min(1).max(60),
});

export const HeartbeatRequest = z.object({
  entries: z.array(UsageEntry).max(MAX_HEARTBEAT_ENTRIES),
  currentDomain: z.string().max(253).nullable(),
  browser: z.enum(["chrome", "edge", "brave", "other"]),
  extensionVersion: z.string().max(32),
});

export const HeartbeatEnvelope = z.object({
  entries: z.array(z.unknown()),
  currentDomain: z.string().max(253).nullable(),
  browser: z.enum(["chrome", "edge", "brave", "other"]),
  extensionVersion: z.string().max(32),
});

export const HeartbeatResponse = z.object({
  rulesVersion: z.number().int().nonnegative(),
});

// Stubs: real limits and the `blocked` field are added by the developer (add-site-blocking-rules).
export const MAX_BLOCKED_ATTEMPTS = 0;
export const MAX_RULE_DOMAINS = 0;

export const BlockedAttempt = z.object({
  at: z.iso.datetime(),
  domain: z.string().min(1).max(253),
});

export const RulesResponse = z.object({
  rulesVersion: z.number().int().nonnegative(),
  domains: z.array(z.string()),
  truncated: z.boolean(),
});

export type RulesResponse = z.infer<typeof RulesResponse>;
export type BlockedAttempt = z.infer<typeof BlockedAttempt>;
export type UsageEntry = z.infer<typeof UsageEntry>;
export type HeartbeatRequest = z.infer<typeof HeartbeatRequest>;
export type HeartbeatResponse = z.infer<typeof HeartbeatResponse>;
