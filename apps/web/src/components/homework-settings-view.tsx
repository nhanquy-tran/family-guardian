import type { Category } from "@fg/shared";
import type { HomeworkError } from "../lib/homework";

export type HomeworkSettingsViewProps = {
  childId: string;
  childName: string;
  categories: Category[];
  extraDomains: string[];
  error: HomeworkError | null;
};

export function HomeworkSettingsView(_props: HomeworkSettingsViewProps): never {
  throw new Error("not implemented");
}
