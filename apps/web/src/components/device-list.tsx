import type { ChildDevices } from "../lib/devices/devices";

export type DeviceListProps = {
  groups: ChildDevices[];
  now: Date;
  error?: string;
  confirmRemoveId: string | null;
  renameAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
};

export function DeviceList(_props: DeviceListProps): never {
  throw new Error("not implemented");
}
