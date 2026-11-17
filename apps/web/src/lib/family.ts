export interface FamilyClient {
  from(table: string): {
    select(columns: string): {
      maybeSingle(): PromiseLike<{
        data: { families: { name: string | null } | null } | null;
        error: unknown;
      }>;
    };
  };
}

const FALLBACK_NAME = "My family";

export async function getFamilyName(client: FamilyClient): Promise<string> {
  const { data, error } = await client.from("parents").select("families(name)").maybeSingle();
  if (error) return FALLBACK_NAME;
  return data?.families?.name || FALLBACK_NAME;
}
