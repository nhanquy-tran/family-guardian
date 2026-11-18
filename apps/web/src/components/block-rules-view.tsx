import Link from "next/link";
import { CATEGORIES } from "@fg/shared";
import type { ReactElement } from "react";
import type { BlockRule } from "../lib/block-rules";
import { alertError, buttonDanger, buttonPrimary, card, input, pageTitle, pillGrey } from "./ui";

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

const LINK = "text-sm font-medium text-accent-ink underline";

export function BlockRulesView({ childId, childName, rules, error, actions }: BlockRulesViewProps): ReactElement {
  return (
    <div className="space-y-6">
      <h1 className={pageTitle}>Block sites for {childName}</h1>
      <Link href="/dashboard/children" className={LINK}>Back to children</Link>
      {error ? <p role="alert" className={alertError}>{MESSAGES[error] ?? MESSAGES.failed}</p> : null}

      <form action={actions?.addDomainAction} className={`${card} flex flex-wrap gap-2`}>
        <input type="hidden" name="childId" value={childId} />
        <input type="text" name="domain" required maxLength={253} placeholder="example.com" aria-label="Domain to block" className={input} />
        <button type="submit" className={buttonPrimary}>Block domain</button>
      </form>

      <form action={actions?.addCategoryAction} className={`${card} flex flex-wrap gap-2`}>
        <input type="hidden" name="childId" value={childId} />
        <select name="category" aria-label="Category to block" className={input}>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <button type="submit" className={buttonPrimary}>Block category</button>
      </form>

      {rules.length === 0 && error !== "failed" ? <p>No sites blocked</p> : null}

      <ul className="space-y-2">
        {rules.map((rule) => (
          <li key={rule.id} className={`${card} flex flex-wrap items-center gap-3 py-3`}>
            <span className={pillGrey}>{rule.kind}</span>
            <span className="font-medium">{rule.value}</span>
            <form action={actions?.removeRuleAction}>
              <input type="hidden" name="childId" value={childId} />
              <input type="hidden" name="ruleId" value={rule.id} />
              <button type="submit" className={buttonDanger}>Remove</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
