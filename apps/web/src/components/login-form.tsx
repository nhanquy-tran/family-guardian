import { buttonPrimary, card } from "./ui";

export function LoginForm({ error }: { error?: string }) {
  return (
    <form method="post" action="/auth/sign-in" className={`${card} flex flex-col gap-4`}>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Sign-in failed. Please try again.
        </p>
      ) : null}
      <button type="submit" className={`${buttonPrimary} w-full`}>
        Continue with Google
      </button>
    </form>
  );
}
