import { describe, expect, it } from "vitest";
import { homeworkDomainsFor } from "./homework";

describe("homeworkDomainsFor", () => {
  it("Category match", () => {
    expect(homeworkDomainsFor(["khanacademy.org", "youtube.com"], { categories: ["education"], extraDomains: [] })).toEqual([
      "khanacademy.org",
    ]);
  });

  it("Extra domain and its subdomains", () => {
    expect(
      homeworkDomainsFor(["example-school.org", "portal.example-school.org", "notexample-school.org"], {
        categories: [],
        extraDomains: ["example-school.org"],
      }),
    ).toEqual(["example-school.org", "portal.example-school.org"]);
  });

  it("Nothing selected", () => {
    expect(homeworkDomainsFor(["khanacademy.org"], { categories: [], extraDomains: [] })).toEqual([]);
  });

  it("Duplicates removed and order stable", () => {
    expect(
      homeworkDomainsFor(["khanacademy.org", "coursera.org", "khanacademy.org"], { categories: ["education"], extraDomains: [] }),
    ).toEqual(["coursera.org", "khanacademy.org"]);
  });
});
