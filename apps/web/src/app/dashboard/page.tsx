import Link from "next/link";
import { listChildren } from "../../lib/children";
import { createClient } from "../../lib/supabase/server";

export default async function Page() {
  const children = await listChildren(await createClient());
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Overview</h1>
      {children.length === 0 ? (
        <p className="text-sm">
          No children yet. <Link href="/dashboard/children" className="underline">Add a child</Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {children.map((child) => (
            <li key={child.id} className="flex items-center justify-between gap-2">
              <span className="font-medium">{child.name}</span>
              <Link href={`/dashboard/usage/${encodeURIComponent(child.id)}`} className="text-sm underline">
                View usage
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
