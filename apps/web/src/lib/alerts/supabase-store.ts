import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfflineAlertStore } from "./offline";

export function createOfflineAlertStore(_client: SupabaseClient): OfflineAlertStore {
  throw new Error("not implemented");
}
