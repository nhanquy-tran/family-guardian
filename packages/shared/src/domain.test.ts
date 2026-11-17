import { describe, expect, it } from "vitest";
import { registrableDomain } from "./domain";

describe("registrableDomain", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc", "youtube.com"],
    ["https://m.facebook.com/", "facebook.com"],
    ["https://bbc.co.uk/news", "bbc.co.uk"],
    ["https://news.bbc.co.uk/x", "bbc.co.uk"],
    ["http://localhost:3000/", "localhost"],
    ["http://192.168.1.10/admin", "192.168.1.10"],
  ])("%s -> %s", (url, expected) => {
    expect(registrableDomain(url)).toBe(expected);
  });

  it.each(["chrome://extensions", "file:///C:/x.html", "not a url", "edge://settings"])("ignores %s", (url) => {
    expect(registrableDomain(url)).toBeNull();
  });
});
