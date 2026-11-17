import type { ReactElement } from "react";
import type { ChildRow } from "../lib/children";
import { PAIRING_ERROR_MESSAGES, type PairingErrorReason } from "../lib/pairing/create-code";

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

const INPUT = "rounded border border-gray-300 px-2 py-1";
const BUTTON = "rounded bg-gray-900 px-3 py-1 text-white";
const LINK = "text-sm text-red-700 underline";

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
      <h1 className="text-2xl font-semibold">Children</h1>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}

      <form action={actions.addChildAction} className="flex gap-2">
        <input name="name" required maxLength={50} placeholder="Child's name" aria-label="Child's name" className={INPUT} />
        <button type="submit" className={BUTTON}>Add child</button>
      </form>

      {items.length === 0 ? <p>No children yet</p> : null}

      <ul className="space-y-4">
        {items.map((child) => {
          const active = activeCodes[child.id];
          return (
            <li key={child.id} className="space-y-2 rounded border border-gray-200 p-4">
              <p className="font-medium">{child.name}</p>
              <form action={actions.renameChildAction} className="flex gap-2">
                <input type="hidden" name="id" value={child.id} />
                <input name="name" required maxLength={50} defaultValue={child.name} aria-label="New name" className={INPUT} />
                <button type="submit" className={BUTTON}>Rename</button>
              </form>
              <a href={`/dashboard/children/${encodeURIComponent(child.id)}/rules`} className="text-sm underline">Block sites</a>
              <a href={`/dashboard/children?confirmDelete=${encodeURIComponent(child.id)}`} className={LINK}>Delete</a>
              <form action={actions.createCodeAction} className="flex items-center gap-2">
                <input type="hidden" name="childId" value={child.id} />
                <button type="submit" className={BUTTON}>Pair a device</button>
              </form>
              {active ? (
                <p>
                  Pairing code <strong className="font-mono text-lg">{active.code}</strong>. Valid until{" "}
                  {active.expiresAt}
                </p>
              ) : null}
              {pairError?.childId === child.id ? (
                <div role="alert" className="space-y-2 text-red-700">
                  <p>{PAIRING_ERROR_MESSAGES[pairError.reason]}</p>
                  {pairError.reason === "in-use" ? (
                    <form action={actions.createCodeAction}>
                      <input type="hidden" name="childId" value={child.id} />
                      <button type="submit" className={BUTTON}>Generate another code</button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pending ? (
        <form action={actions.deleteChildAction} className="space-y-2 rounded border border-red-300 p-4">
          <input type="hidden" name="id" value={pending.id} />
          <p>
            Delete {pending.name}? This also deletes its devices and usage history.
          </p>
          <div className="flex items-center gap-3">
            <button type="submit" className="rounded bg-red-700 px-3 py-1 text-white">Confirm delete</button>
          </div>
        </form>
      ) : null}
      {pending ? <a href="/dashboard/children" className="text-sm underline">Cancel</a> : null}
    </div>
  );
}
