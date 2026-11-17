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

export type UsageEntry = z.infer<typeof UsageEntry>;
export type HeartbeatRequest = z.infer<typeof HeartbeatRequest>;
export type HeartbeatResponse = z.infer<typeof HeartbeatResponse>;
