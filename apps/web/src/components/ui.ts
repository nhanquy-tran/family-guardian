const focusRing = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft";
const button =
  "inline-flex min-h-10 items-center justify-center rounded-pill px-4 py-2 text-sm font-medium transition active:scale-[.98] " +
  focusRing;
const pill = "inline-flex items-center rounded-pill border px-3 py-1 text-xs font-medium text-ink";

export const container: string = "mx-auto min-h-screen w-full max-w-6xl p-4 sm:p-6";
export const card: string = "w-full rounded-card bg-card p-4 shadow-card sm:p-6";
export const cardTitle: string = "mb-3 text-lg font-semibold tracking-tight text-ink";
export const pageTitle: string = "mb-4 text-[22px] font-semibold tracking-tight text-ink";

export const buttonPrimary: string = `${button} bg-accent text-accent-contrast hover:opacity-90`;
export const buttonSecondary: string = `${button} border border-line-2 bg-card text-ink hover:bg-line`;
export const buttonDanger: string = `${button} border border-red bg-card text-ink hover:bg-red-soft`;

export const input: string =
  "min-h-10 rounded-sm border border-line-2 bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft";

export const pillGreen: string = `${pill} border-green bg-green-soft`;
export const pillAmber: string = `${pill} border-amber bg-amber-soft`;
export const pillRed: string = `${pill} border-red bg-red-soft`;
export const pillAccent: string = `${pill} border-accent bg-accent-soft`;
export const pillGrey: string = `${pill} border-line-2 bg-line`;

export const table: string = "w-full overflow-x-auto";
export const th: string = "px-3 py-2 text-left text-xs font-medium text-ink-2";
export const td: string = "border-t border-line px-3 py-2 text-sm text-ink";

export const navLink: string =
  "inline-flex min-h-10 items-center rounded-pill px-3 py-2 text-sm font-medium hover:bg-line " + focusRing;
export const navLinkCurrent: string = "bg-accent-soft text-accent-ink";

export const alertError: string = "rounded-sm border border-red bg-red-soft p-3 text-sm text-ink";
export const alertWarning: string = "rounded-sm border border-amber bg-amber-soft p-3 text-sm text-ink";
