import type { ReactElement } from "react";
import type { DailyLimit } from "../lib/daily-limits";

export type DailyLimitsCardProps = {
  childId: string;
  limits: DailyLimit[];
  error: string | null;
  action?: (formData: FormData) => void | Promise<void>;
};

export function DailyLimitsCard(_props: DailyLimitsCardProps): ReactElement {
  throw new Error("not implemented");
}
