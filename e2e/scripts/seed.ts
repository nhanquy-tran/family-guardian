import { generate, STAGES, type Stage } from "../fixtures/scenario.ts";
import { seed, teardown } from "../fixtures/store.ts";
import { supabaseStore } from "../fixtures/supabase-store.ts";
import { localSupabase } from "../local-supabase.ts";

const args = process.argv.slice(2);
const store = supabaseStore(localSupabase());

if (args.includes("--teardown-only")) {
  await teardown(store);
  console.log("Removed all e2e data.");
} else {
  const flag = args.indexOf("--stage");
  const stage = (flag >= 0 ? args[flag + 1] : "alerts") as Stage;
  if (!STAGES.includes(stage)) throw new Error(`--stage must be one of ${STAGES.join(", ")}`);
  const f = generate(stage);
  await seed(store, f);
  console.log(`Seeded stage "${stage}" for ${f.parent.email}: ${f.children.length} children, ${f.usage.length} usage rows.`);
}
