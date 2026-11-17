import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PAIRING_ERROR_MESSAGES } from "../lib/pairing/create-code";
import { ChildrenList, type ChildrenListProps } from "./children-list";

const CHILDREN = [
  { id: "c1", name: "Minh" },
  { id: "c2", name: "An" },
];

function stubActions(): ChildrenListProps["actions"] {
  return {
    addChildAction: vi.fn(),
    renameChildAction: vi.fn(),
    deleteChildAction: vi.fn(),
    createCodeAction: vi.fn(),
  };
}

function render(overrides: Partial<ChildrenListProps> = {}): string {
  const props: ChildrenListProps = {
    items: CHILDREN,
    activeCodes: {},
    error: null,
    pairError: null,
    confirmDelete: null,
    actions: stubActions(),
    ...overrides,
  };
  return renderToStaticMarkup(createElement(ChildrenList, props));
}

const buttons = (html: string, label: string) =>
  [...html.matchAll(/<button[^>]*>\s*([^<]*?)\s*<\/button>/g)].filter((m) => m[1] === label);
const links = (html: string, label: string) =>
  [...html.matchAll(/<a([^>]*)>\s*([^<]*?)\s*<\/a>/g)].filter((m) => m[2] === label);
const forms = (html: string) => html.match(/<form[\s\S]*?<\/form>/g) ?? [];

describe("ChildrenList delete confirmation", () => {
  it("Delete link leads to confirmation, no direct delete", () => {
    const html = render();
    const deletes = links(html, "Delete");
    expect(deletes).toHaveLength(2);
    expect(deletes[0][1]).toMatch(/href="[^"]*\?confirmDelete=c1"/);
    expect(deletes[1][1]).toMatch(/href="[^"]*\?confirmDelete=c2"/);
    expect(html).not.toContain("Confirm delete");
    for (const form of forms(html)) expect(form).not.toMatch(/>\s*Delete\s*</);
    // add form + a rename and a pair form per child, nothing else
    expect(forms(html)).toHaveLength(5);
  });

  it("Confirm view names the child", () => {
    const html = render({ confirmDelete: "c1" });
    expect(buttons(html, "Confirm delete")).toHaveLength(1);
    const confirmForm = forms(html).find((f) => f.includes("Confirm delete")) ?? "";
    expect(confirmForm).toMatch(/<input[^>]*name="id"[^>]*value="c1"|<input[^>]*value="c1"[^>]*name="id"/);
    expect(confirmForm).toMatch(/type="hidden"/);
    expect(confirmForm).toContain("Minh");
    expect(html).toContain("This also deletes its devices and usage history.");
    expect(links(html, "Cancel")).toHaveLength(1);
    expect(links(html, "Cancel")[0][1]).toContain('href="/dashboard/children"');
    expect(html.match(/Confirm delete/g)).toHaveLength(1);
    expect(forms(html).filter((f) => f.includes("Confirm delete"))).toHaveLength(1);
  });

  it("Cancel is a plain link", () => {
    const actions = stubActions();
    const html = render({ confirmDelete: "c1", actions });
    expect(buttons(html, "Cancel")).toHaveLength(0);
    expect(links(html, "Cancel")[0][1]).toContain('href="/dashboard/children"');
    expect(forms(html).some((f) => f.includes("Cancel"))).toBe(false);
    expect(actions.deleteChildAction).not.toHaveBeenCalled();
  });

  it("Unknown confirmDelete id", () => {
    const html = render({ items: [CHILDREN[0]], confirmDelete: "other" });
    expect(html).not.toContain("Confirm delete");
    expect(html).not.toContain("This also deletes");
  });
});

describe("ChildrenList markup", () => {
  it("Children with controls", () => {
    const html = render();
    expect(html).toContain("Minh");
    expect(html).toContain("An");
    expect(buttons(html, "Add child")).toHaveLength(1);
    expect(buttons(html, "Rename")).toHaveLength(2);
    expect(links(html, "Delete")).toHaveLength(2);
    expect(buttons(html, "Pair a device")).toHaveLength(2);
    const nameInputs = [...html.matchAll(/<input[^>]*name="name"[^>]*>/g)].map((m) => m[0]);
    expect(nameInputs).toHaveLength(3);
    for (const input of nameInputs) {
      expect(input).toMatch(/maxlength="50"/i);
      expect(input).toContain("required");
    }
  });

  it("Empty state and error", () => {
    const html = render({ items: [], error: "Name must be 1 to 50 characters" });
    expect(html).toContain("No children yet");
    expect(html).toContain("Name must be 1 to 50 characters");
    expect(buttons(html, "Add child")).toHaveLength(1);
  });
});

describe("ChildrenList pairing code", () => {
  it("Active code shown", () => {
    const html = render({
      items: [CHILDREN[0]],
      activeCodes: { c1: { code: "AB2CD3", expiresAt: "2026-11-17T11:00:00.000Z" } },
    });
    expect(html).toContain("AB2CD3");
    expect(html).toContain("Valid until");
  });

  it("In-use error with generate-another button", () => {
    const html = render({ items: [CHILDREN[0]], pairError: { childId: "c1", reason: "in-use" } });
    expect(PAIRING_ERROR_MESSAGES["in-use"]).toBe("This code is already in use. Generate another code.");
    expect(html).toContain(PAIRING_ERROR_MESSAGES["in-use"]);
    expect(buttons(html, "Generate another code")).toHaveLength(1);
  });
});
