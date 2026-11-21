import { ActionForm } from "./action-form";
import { CATEGORIES } from "@fg/shared";
import type { ReactElement } from "react";
import type { CategoryOverride } from "../lib/category-overrides";
import { alertError, buttonDanger, buttonPrimary, card, input, pageTitle, pillGrey } from "./ui";

type FormAction = (formData: FormData) => void | Promise<void>;

export type CategoryOverridesViewProps = {
  overrides: CategoryOverride[];
  error: string | null;
  domain?: string | null;
  actions?: { saveAction: FormAction; removeAction: FormAction };
};

const MESSAGES: Record<string, string> = {
  invalid_domain: "Enter a valid domain such as youtube.com",
  invalid_category: "Choose one of the listed categories",
  not_found: "That override no longer exists",
  failed: "Overrides could not be loaded or saved. Please try again.",
};

export function CategoryOverridesView({ overrides, error, domain, actions }: CategoryOverridesViewProps): ReactElement {
  return (
    <div className="space-y-6">
      <h1 className={pageTitle}>Categories</h1>
      {error ? <p role="alert" className={alertError}>{MESSAGES[error] ?? MESSAGES.failed}</p> : null}

      <ActionForm action={actions?.saveAction} className={`${card} flex flex-wrap gap-2`}>
        <input
          type="text"
          name="domain"
          required
          maxLength={253}
          placeholder="example.com"
          aria-label="Domain"
          defaultValue={domain ?? undefined}
          className={input}
        />
        <select name="category" aria-label="Category" className={input}>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <button type="submit" className={buttonPrimary}>Save override</button>
      </ActionForm>

      {overrides.length === 0 && error !== "failed" ? <p>No overrides yet</p> : null}

      <ul className="space-y-2">
        {overrides.map((o) => (
          <li key={o.id} className={`${card} flex flex-wrap items-center gap-3 py-3`}>
            <span className="font-medium">{o.domain}</span>
            <span className={pillGrey}>{o.category}</span>
            <ActionForm action={actions?.removeAction}>
              <input type="hidden" name="id" value={o.id} />
              <button type="submit" aria-label={`Remove override for ${o.domain}`} className={buttonDanger}>Remove</button>
            </ActionForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
