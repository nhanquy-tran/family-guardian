import Link from "next/link";
import type { ReactElement } from "react";
import type { ChildRow } from "../lib/children";
import { PAIRING_ERROR_MESSAGES, type PairingErrorReason } from "../lib/pairing/create-code";
import { alertError, buttonDanger, buttonPrimary, card, cardTitle, input, pageTitle } from "./ui";

type FormAction = (formData: FormData) => void | Promise<void>;

export type ChildrenListProps = {
  items: Pick<ChildRow, "id" | "name">[];
  activeCodes: Record<string, { code: string; expiresAt: string }>;
  error: string | null;
  pairError: { childId: string; reason: PairingErrorReason } | null;
  confirmDelete: string | null;
  actions: {
    addChildAction: FormAction;
    renameChildAction: FormAction;
    deleteChildAction: FormAction;
    createCodeAction: FormAction;
  };
};

const LINK = "text-sm font-medium text-accent-ink underline";

export function ChildrenList({
  items,
  activeCodes,
  error,
  pairError,
  confirmDelete,
  actions,
}: ChildrenListProps): ReactElement {
  const pending = items.find((child) => child.id === confirmDelete);

  return (
    <div className="space-y-6">
      <h1 className={pageTitle}>Children</h1>
      {error ? <p role="alert" className={alertError}>{error}</p> : null}

      <form action={actions.addChildAction} className={`${card} flex flex-wrap gap-2`}>
        <input name="name" required maxLength={50} placeholder="Child's name" aria-label="Child's name" className={input} />
        <button type="submit" className={buttonPrimary}>Add child</button>
      </form>

      {items.length === 0 ? <p className="text-ink-2">No children yet</p> : null}

      <ul className="space-y-4">
        {items.map((child) => {
          const active = activeCodes[child.id];
          return (
            <li key={child.id} className={`${card} space-y-3`}>
              <p className={cardTitle}>{child.name}</p>
              <form action={actions.renameChildAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={child.id} />
                <input name="name" required maxLength={50} defaultValue={child.name} aria-label="New name" className={input} />
                <button type="submit" className={buttonPrimary}>Rename</button>
              </form>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <a href={`/dashboard/children/${encodeURIComponent(child.id)}/rules`} className={LINK}>Block sites</a>
                <a href={`/dashboard/children/${encodeURIComponent(child.id)}/homework`} className={LINK}>Homework</a>
                <a href={`/dashboard/children?confirmDelete=${encodeURIComponent(child.id)}`} className={LINK}>Delete</a>
              </div>
              <form action={actions.createCodeAction} className="flex items-center gap-2">
                <input type="hidden" name="childId" value={child.id} />
                <button type="submit" className={buttonPrimary}>Pair a device</button>
              </form>
              {active ? (
                <p>
                  Pairing code <strong className="font-mono text-lg">{active.code}</strong>. Valid until{" "}
                  {active.expiresAt}
                </p>
              ) : null}
              {pairError?.childId === child.id ? (
                <div role="alert" className={`${alertError} space-y-2`}>
                  <p>{PAIRING_ERROR_MESSAGES[pairError.reason]}</p>
                  {pairError.reason === "in-use" ? (
                    <form action={actions.createCodeAction}>
                      <input type="hidden" name="childId" value={child.id} />
                      <button type="submit" className={buttonPrimary}>Generate another code</button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pending ? (
        <form action={actions.deleteChildAction} className={`${card} space-y-2`}>
          <input type="hidden" name="id" value={pending.id} />
          <p>
            Delete {pending.name}? This also deletes its devices and usage history. Its block history is deleted too.
          </p>
          <div className="flex items-center gap-3">
            <button type="submit" className={buttonDanger}>Confirm delete</button>
          </div>
        </form>
      ) : null}
      {pending ? <Link href="/dashboard/children" className={LINK}>Cancel</Link> : null}
    </div>
  );
}
