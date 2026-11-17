import { CATEGORIES } from "@fg/shared";
import type { ReactElement } from "react";
import type { BlockRule } from "../lib/block-rules";

type FormAction = (formData: FormData) => void | Promise<void>;

export type BlockRulesViewProps = {
  childId: string;
  childName: string;
  rules: BlockRule[];
  error: string | null;
  actions?: { addDomainAction: FormAction; addCategoryAction: FormAction; removeRuleAction: FormAction };
};

const MESSAGES: Record<string, string> = {
  invalid_domain: "Enter a valid domain such as youtube.com",
  invalid_category: "Choose one of the listed categories",
  duplicate: "That site or category is already blocked",
  not_found: "That rule no longer exists",
  failed: "Rules could not be loaded or saved. Please try again.",
};

const INPUT = "rounded border border-gray-300 px-2 py-1";
const BUTTON = "rounded bg-gray-900 px-3 py-1 text-white";

export function BlockRulesView({ childId, childName, rules, error, actions }: BlockRulesViewProps): ReactElement {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Block sites for {childName}</h1>
      <a href="/dashboard/children" className="text-sm underline">Back to children</a>
      {error ? <p role="alert" className="text-red-700">{MESSAGES[error] ?? MESSAGES.failed}</p> : null}

      <form action={actions?.addDomainAction} className="flex gap-2">
        <input type="hidden" name="childId" value={childId} />
        <input type="text" name="domain" required maxLength={253} placeholder="example.com" aria-label="Domain to block" className={INPUT} />
        <button type="submit" className={BUTTON}>Block domain</button>
      </form>

      <form action={actions?.addCategoryAction} className="flex gap-2">
        <input type="hidden" name="childId" value={childId} />
        <select name="category" aria-label="Category to block" className={INPUT}>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <button type="submit" className={BUTTON}>Block category</button>
      </form>

      {rules.length === 0 && error !== "failed" ? <p>No sites blocked</p> : null}

      <ul className="space-y-2">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{rule.kind}</span>
            <span className="font-medium">{rule.value}</span>
            <form action={actions?.removeRuleAction}>
              <input type="hidden" name="childId" value={childId} />
              <input type="hidden" name="ruleId" value={rule.id} />
              <button type="submit" className="text-sm text-red-700 underline">Remove</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
