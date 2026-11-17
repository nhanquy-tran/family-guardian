import { ChildrenList } from "../../../components/children-list";
import { listChildren } from "../../../lib/children";
import type { PairingErrorReason } from "../../../lib/pairing/create-code";
import { createClient } from "../../../lib/supabase/server";
import { addChildAction, createCodeAction, deleteChildAction, renameChildAction } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const REASONS: PairingErrorReason[] = ["in-use", "custom-in-use", "failed"];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const client = await createClient();
  const items = await listChildren(client);

  const { data: codes } = await client
    .from("pairing_codes")
    .select("code, child_id, expires_at")
    .gt("expires_at", new Date().toISOString());
  const activeCodes: Record<string, { code: string; expiresAt: string }> = {};
  for (const row of codes ?? []) activeCodes[row.child_id] = { code: row.code, expiresAt: row.expires_at };

  const reason = REASONS.find((r) => r === first(params.reason));
  const pairChild = first(params.pairError);
  return (
    <ChildrenList
      items={items}
      activeCodes={activeCodes}
      error={first(params.error)}
      pairError={pairChild && reason ? { childId: pairChild, reason } : null}
      confirmDelete={first(params.confirmDelete)}
      actions={{ addChildAction, renameChildAction, deleteChildAction, createCodeAction }}
    />
  );
}
