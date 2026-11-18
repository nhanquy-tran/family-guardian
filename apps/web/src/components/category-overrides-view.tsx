import type { ReactElement } from "react";
import type { CategoryOverride } from "../lib/category-overrides";

type FormAction = (formData: FormData) => void | Promise<void>;

export type CategoryOverridesViewProps = {
  overrides: CategoryOverride[];
  error: string | null;
  domain?: string | null;
  actions?: { saveAction: FormAction; removeAction: FormAction };
};

export function CategoryOverridesView(_props: CategoryOverridesViewProps): ReactElement {
  throw new Error("not implemented");
}
