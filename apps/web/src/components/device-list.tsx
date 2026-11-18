import Link from "next/link";
import { type ChildDevices, deviceErrorMessage } from "../lib/devices/devices";
import { browserLabel, deviceLabel, deviceStatus, formatLastSeen } from "../lib/devices/status";
import { alertError, buttonDanger, buttonSecondary, card, cardTitle, input, pillGreen, pillGrey } from "./ui";

export type DeviceListProps = {
  groups: ChildDevices[];
  now: Date;
  error?: string;
  confirmRemoveId: string | null;
  renameAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
};

const LINK = "text-sm font-medium text-accent-ink underline";

export function DeviceList({ groups, now, error, confirmRemoveId, renameAction, removeAction }: DeviceListProps) {
  const message = deviceErrorMessage(error);
  return (
    <div className="space-y-8">
      {message && (
        <p role="alert" className={alertError}>
          {message}
        </p>
      )}
      {groups.map((child) => (
        <section key={child.id} className="space-y-3">
          <h2 className={cardTitle}>{child.name}</h2>
          {child.devices.length === 0 && (
            <p className="text-ink-2">
              No devices yet.{" "}
              <Link href="/dashboard/children" className={LINK}>
                Go to children
              </Link>
            </p>
          )}
          {child.devices.map((device) => {
            const status = deviceStatus(device.last_seen_at, now);
            return (
              <div key={device.id} className={`${card} space-y-2`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{deviceLabel(device)}</span>
                  <span data-status={status} className={status === "online" ? pillGreen : pillGrey}>
                    {status === "online" ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="text-sm text-ink-2">
                  {browserLabel(device.browser)} · {device.os} · Version {device.extension_version ?? "unknown"} · Last
                  seen {formatLastSeen(device.last_seen_at, now)}
                </p>
                <form action={renameAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="deviceId" value={device.id} />
                  <input name="name" maxLength={40} required aria-label="Device name" className={input} />
                  <button type="submit" className={buttonSecondary}>Rename</button>
                </form>
                <a href={`/dashboard/devices?remove=${encodeURIComponent(device.id)}`} className={LINK}>
                  Remove
                </a>
                {confirmRemoveId === device.id && (
                  <div role="alertdialog" className={`${alertError} space-y-2`}>
                    <p>
                      Remove {deviceLabel(device)} from {child.name}? This will delete the device and its usage history.
                      This cannot be undone.
                    </p>
                    <form action={removeAction} className="inline">
                      <input type="hidden" name="deviceId" value={device.id} />
                      <button type="submit" className={buttonDanger}>Yes, remove</button>
                    </form>{" "}
                    <Link href="/dashboard/devices" className={LINK}>
                      Cancel
                    </Link>
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
