import type { SupabaseClient } from "@supabase/supabase-js";
import type { HeartbeatStore } from "./heartbeat";

export function createHeartbeatStore(_client: SupabaseClient): HeartbeatStore {
  throw new Error("not implemented");
}
