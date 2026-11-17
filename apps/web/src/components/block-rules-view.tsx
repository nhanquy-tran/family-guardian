import type { BlockRule } from "../lib/block-rules";

export type BlockRulesViewProps = {
  childId: string;
  childName: string;
  rules: BlockRule[];
  error: string | null;
};

// Stub: implemented by the developer (add-site-blocking-rules).
export function BlockRulesView(_props: BlockRulesViewProps): never {
  throw new Error("not implemented");
}
