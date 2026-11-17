export function LoginForm({ error }: { error?: string }) {
  return (
    <form method="post" action="/auth/sign-in" className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          Sign-in failed. Please try again.
        </p>
      ) : null}
      <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
        Continue with Google
      </button>
    </form>
  );
}
