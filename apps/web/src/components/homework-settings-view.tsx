import { CATEGORIES, type Category } from "@fg/shared";
import type { ReactElement } from "react";
import type { HomeworkError } from "../lib/homework";

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

const INPUT = "rounded border border-gray-300 px-2 py-1";
const BUTTON = "rounded bg-gray-900 px-3 py-1 text-white";

export function HomeworkSettingsView({ childId, childName, categories, extraDomains, error, actions }: HomeworkSettingsViewProps): ReactElement {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Homework for {childName}</h1>
      <a href="/dashboard/children" className="text-sm underline">Back to children</a>
      {error ? <p role="alert" className="text-red-700">{MESSAGES[error] ?? MESSAGES.failed}</p> : null}

      <form action={actions?.saveCategoriesAction} className="space-y-2">
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
        <button type="submit" className={BUTTON}>Save categories</button>
      </form>

      <section className="space-y-2">
        <h2 className="font-medium">Extra homework sites</h2>
        <form action={actions?.addDomainAction} className="flex gap-2">
          <input type="hidden" name="childId" value={childId} />
          <input type="text" name="domain" required maxLength={253} placeholder="example.com" aria-label="Homework site" className={INPUT} />
          <button type="submit" className={BUTTON}>Add site</button>
        </form>
        {extraDomains.length === 0 ? <p className="text-sm text-gray-600">No extra sites</p> : null}
        {extraDomains.map((domain) => (
          <form key={domain} action={actions?.removeDomainAction} className="flex items-center gap-2">
            <input type="hidden" name="childId" value={childId} />
            <input type="hidden" name="domain" value={domain} />
            <span>{domain}</span>
            <button type="submit" className="text-sm text-red-700 underline">Remove</button>
          </form>
        ))}
      </section>
    </div>
  );
}
