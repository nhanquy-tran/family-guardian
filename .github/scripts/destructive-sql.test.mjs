import { describe, expect, it } from "vitest";
import { destructiveStatements } from "./destructive-sql.mjs";

describe("destructiveStatements", () => {
  it("flags statements that lose data or break the running app", () => {
    const sql = [
      "drop table public.pair_attempts;",
      "alter table devices drop column os;",
      "ALTER TABLE devices DROP COLUMN IF EXISTS os;",
      "truncate usage_minutes;",
      "delete from usage_minutes where minute_utc < now();",
      "alter table devices alter column browser type text;",
      "alter table devices alter column browser set data type text;",
      "alter table devices rename column os to platform;",
      "alter table devices rename to browsers;",
      "drop schema legacy cascade;",
    ].join("\n");
    expect(destructiveStatements(sql)).toHaveLength(10);
  });

  it("ignores recreatable objects, cascades, comments and strings", () => {
    const sql = [
      "drop policy if exists p on children;",
      "drop function if exists bump();",
      "alter table devices drop constraint if exists devices_browser_check;",
      "drop index if exists i; drop trigger if exists t on x; drop view if exists v;",
      "create table x (id uuid references children on delete cascade);",
      "-- delete from usage_minutes is done by the purge job",
      "comment on table x is 'we never drop table here';",
      "create function purge() returns void language sql as $$ delete from usage_minutes where minute_utc < now() $$;",
      "create function f() returns trigger language plpgsql as $body$ begin delete from t; return null; end $body$;",
    ].join("\n");
    expect(destructiveStatements(sql)).toEqual([]);
  });

  it("returns the matched statement text", () => {
    expect(destructiveStatements("select 1;\nDELETE FROM t where a = 1;")).toEqual(["DELETE FROM t where a = 1"]);
  });
});
