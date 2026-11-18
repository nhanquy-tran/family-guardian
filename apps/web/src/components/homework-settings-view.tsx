import Link from "next/link";
import { CATEGORIES, type Category } from "@fg/shared";
import type { ReactElement } from "react";
import type { HomeworkError } from "../lib/homework";
import { alertError, buttonDanger, buttonPrimary, card, cardTitle, input, pageTitle } from "./ui";

type FormAction = (formData: FormData) => void | Promise<void>;

export type HomeworkSettingsViewProps = {
  childId: string;
  childName: string;
  categories: Category[];
  extraDomains: string[];
  error: HomeworkError | null;
  actions?: { saveCategoriesAction: FormAction; addDomainAction: FormAction; removeDomainAction: FormAction };
};

const MESSAGES: Record<HomeworkError, string> = {
  invalid_category: "Choose only the listed categories",
  invalid_domain: "Enter a valid domain such as khanacademy.org",
  duplicate: "That site is already in the list",
  too_many: "You can add at most 50 sites",
  not_found: "That child no longer exists",
  failed: "Settings could not be loaded or saved. Please try again.",
};

const LINK = "text-sm font-medium text-accent-ink underline";

export function HomeworkSettingsView({ childId, childName, categories, extraDomains, error, actions }: HomeworkSettingsViewProps): ReactElement {
  return (
    <div className="space-y-6">
      <h1 className={pageTitle}>Homework for {childName}</h1>
      <Link href="/dashboard/children" className={LINK}>Back to children</Link>
      {error ? <p role="alert" className={alertError}>{MESSAGES[error] ?? MESSAGES.failed}</p> : null}

      <form action={actions?.saveCategoriesAction} className={`${card} space-y-3`}>
        <input type="hidden" name="childId" value={childId} />
        <fieldset className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <legend className="font-medium">Categories that count as homework</legend>
          {CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2">
              <input type="checkbox" name="category" value={category} defaultChecked={categories.includes(category)} />
              {category}
            </label>
          ))}
        </fieldset>
        <button type="submit" className={buttonPrimary}>Save categories</button>
      </form>

      <section className={`${card} space-y-3`}>
        <h2 className={cardTitle}>Extra homework sites</h2>
        <form action={actions?.addDomainAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="childId" value={childId} />
          <input type="text" name="domain" required maxLength={253} placeholder="example.com" aria-label="Homework site" className={input} />
          <button type="submit" className={buttonPrimary}>Add site</button>
        </form>
        {extraDomains.length === 0 ? <p className="text-sm text-ink-2">No extra sites</p> : null}
        {extraDomains.map((domain) => (
          <form key={domain} action={actions?.removeDomainAction} className="flex items-center gap-2">
            <input type="hidden" name="childId" value={childId} />
            <input type="hidden" name="domain" value={domain} />
            <span>{domain}</span>
            <button type="submit" className={buttonDanger}>Remove</button>
          </form>
        ))}
      </section>
    </div>
  );
}
