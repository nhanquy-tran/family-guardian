import { DeviceList } from "../../../components/device-list";
import { pageTitle } from "@/components/ui";
import { listDevicesByChild } from "../../../lib/devices/devices";
import { createClient } from "../../../lib/supabase/server";
import { removeDeviceAction, renameDeviceAction } from "./actions";

type SearchParams = Promise<{ error?: string | string[]; remove?: string | string[] }>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const client = await createClient();
  const groups = await listDevicesByChild(client);
  return (
    <div className="space-y-6">
      <h1 className={pageTitle}>Devices</h1>
      <DeviceList
        groups={groups ?? []}
        now={new Date()}
        error={groups === null ? "load" : first(params.error)}
        confirmRemoveId={first(params.remove) ?? null}
        renameAction={renameDeviceAction}
        removeAction={removeDeviceAction}
      />
    </div>
  );
}
