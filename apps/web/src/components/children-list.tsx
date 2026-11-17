import type { ReactElement } from "react";
import type { ChildRow } from "../lib/children";
import type { PairingErrorReason } from "../lib/pairing/create-code";

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

export function ChildrenList(props: ChildrenListProps): ReactElement {
  void props;
  throw new Error("not implemented");
}
