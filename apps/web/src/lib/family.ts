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

export async function getFamilyName(_client: FamilyClient): Promise<string> {
  throw new Error("not implemented");
}
