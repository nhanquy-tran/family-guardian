import type { ReactElement } from "react";

export type AllowedHoursCardProps = {
  childId: string;
  hours: { start: string; end: string } | null;
  error: string | null;
  action?: (formData: FormData) => void | Promise<void>;
};

export function AllowedHoursCard(_props: AllowedHoursCardProps): ReactElement {
  throw new Error("not implemented");
}
