import { alertError, buttonPrimary, card } from "./ui";

export function LoginForm({ error }: { error?: string }) {
  return (
    <form method="post" action="/auth/sign-in" className={`${card} flex max-w-sm flex-col gap-4`}>
      <div className="flex items-center justify-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={36} height={36} className="size-9" />
        <span className="text-xl font-semibold tracking-tighter text-ink">Family Guardian</span>
      </div>
      {error ? (
        <p role="alert" className={alertError}>
          Sign-in failed. Please try again.
        </p>
      ) : null}
      <button type="submit" className={`${buttonPrimary} w-full`}>
        Continue with Google
      </button>
    </form>
  );
}
