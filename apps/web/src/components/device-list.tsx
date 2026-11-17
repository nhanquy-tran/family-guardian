import { type ChildDevices, deviceErrorMessage } from "../lib/devices/devices";
import { browserLabel, deviceLabel, deviceStatus, formatLastSeen } from "../lib/devices/status";

export type DeviceListProps = {
  groups: ChildDevices[];
  now: Date;
  error?: string;
  confirmRemoveId: string | null;
  renameAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
};

export function DeviceList({ groups, now, error, confirmRemoveId, renameAction, removeAction }: DeviceListProps) {
  const message = deviceErrorMessage(error);
  return (
    <div className="space-y-8">
      {message && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {message}
        </p>
      )}
      {groups.map((child) => (
        <section key={child.id} className="space-y-3">
          <h2 className="text-lg font-semibold">{child.name}</h2>
          {child.devices.length === 0 && (
            <p className="text-gray-600">
              No devices yet.{" "}
              <a href="/dashboard/children" className="underline">
                Go to children
              </a>
            </p>
          )}
          {child.devices.map((device) => {
            const status = deviceStatus(device.last_seen_at, now);
            return (
              <div key={device.id} className="space-y-2 rounded border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{deviceLabel(device)}</span>
                  <span data-status={status} className={status === "online" ? "text-green-700" : "text-gray-500"}>
                    {status === "online" ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {browserLabel(device.browser)} · {device.os} · Version {device.extension_version ?? "unknown"} · Last
                  seen {formatLastSeen(device.last_seen_at, now)}
                </p>
                <form action={renameAction} className="flex gap-2">
                  <input type="hidden" name="deviceId" value={device.id} />
                  <input name="name" maxLength={40} required aria-label="Device name" className="rounded border px-2" />
                  <button type="submit">Rename</button>
                </form>
                <a href={`/dashboard/devices?remove=${encodeURIComponent(device.id)}`} className="text-red-700 underline">
                  Remove
                </a>
                {confirmRemoveId === device.id && (
                  <div role="alertdialog" className="space-y-2 rounded bg-red-50 p-3">
                    <p>
                      Remove {deviceLabel(device)} from {child.name}? This will delete the device and its usage history.
                      This cannot be undone.
                    </p>
                    <form action={removeAction} className="inline">
                      <input type="hidden" name="deviceId" value={device.id} />
                      <button type="submit">Yes, remove</button>
                    </form>{" "}
                    <a href="/dashboard/devices" className="underline">
                      Cancel
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
