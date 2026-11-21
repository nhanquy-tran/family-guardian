import { loadingOverlay, loadingPanel, spinner } from "./ui";

export function LoadingOverlay() {
  return (
    <div className={loadingOverlay} role="status" aria-live="polite">
      <div className={loadingPanel}>
        <span className={spinner} aria-hidden="true" />
        <span className="text-sm font-medium text-ink-2">Loading…</span>
      </div>
    </div>
  );
}
