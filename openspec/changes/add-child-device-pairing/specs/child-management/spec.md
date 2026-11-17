# Spec Delta

## Purpose

A signed-in parent manages the children of their family on `/dashboard/children`.

Test files:
- `apps/web/src/lib/children.test.ts`: logic with a fake Supabase client that records calls.
- `apps/web/src/components/children-list.test.ts`: markup via `renderToStaticMarkup`.

## ADDED Requirements

### Requirement: Add a child
`addChild(client, name)` SHALL trim the name, reject names that are empty or longer than 50 characters without calling the database, read the parent's `family_id` from `parents`, and insert `{ family_id, name }` into `children`.

#### Scenario: Valid name is inserted into the parent's family
- **GIVEN** a fake client whose `parents.select("family_id").maybeSingle()` resolves `{ data: { family_id: "fam-1" }, error: null }` and whose `children` insert resolves without error
- **WHEN** `addChild(client, "  Minh  ")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: true }`
- **AND** exactly one insert into `children` was made with `{ family_id: "fam-1", name: "Minh" }`

#### Scenario: Invalid names are rejected before the database
- **GIVEN** a fake client that records every `from` call
- **WHEN** `addChild` is called with `""`, `"   "` and a 51-character name (`children.test.ts`)
- **THEN** each returns `{ ok: false, error: "Name must be 1 to 50 characters" }`
- **AND** the fake client's `from` was never called

#### Scenario: Database error is reported
- **GIVEN** a fake client whose `children` insert resolves a non-null `error`
- **WHEN** `addChild(client, "Minh")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: false }` with a non-empty `error` that does not contain the database error message

### Requirement: Rename a child
`renameChild(client, id, name)` SHALL apply the same name validation and update only `name` of the child with that `id`.

#### Scenario: Rename updates only the name
- **GIVEN** a fake client whose `children` update resolves without error
- **WHEN** `renameChild(client, "child-1", " An ")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: true }`
- **AND** the client recorded `from("children").update({ name: "An" }).eq("id", "child-1")` and no other write

#### Scenario: Rename with invalid name
- **GIVEN** a fake client that records writes
- **WHEN** `renameChild(client, "child-1", "")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: false, error: "Name must be 1 to 50 characters" }` and no update was made

### Requirement: Delete a child
`deleteChild(client, id)` SHALL delete the child row with that `id`; its devices and pairing codes are removed by the database cascade from issue #7.

#### Scenario: Delete by id
- **GIVEN** a fake client whose `children` delete resolves without error
- **WHEN** `deleteChild(client, "child-1")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: true }`
- **AND** the client recorded `from("children").delete().eq("id", "child-1")`

### Requirement: Delete needs a confirmation step
`ChildrenList` SHALL render for each child a "Delete" link to `?confirmDelete=<id>` and no direct delete form. For a listed `confirmDelete` id it SHALL render one confirmation form that names the child, states "This also deletes its devices and usage history.", and has "Confirm delete" and "Cancel" controls; only that form posts the delete action.

#### Scenario: Delete link leads to confirmation, no direct delete
- **GIVEN** children `Minh` (`c1`) and `An` (`c2`) and `confirmDelete` `null`
- **WHEN** a test renders `ChildrenList` (`children-list.test.ts`)
- **THEN** the markup has two "Delete" links with `href` `?confirmDelete=c1` and `?confirmDelete=c2` (or the `/dashboard/children` path with that query)
- **AND** it contains no "Confirm delete" button and no form whose action is the delete action

#### Scenario: Confirm view names the child
- **GIVEN** children `Minh` (`c1`) and `An` (`c2`) and `confirmDelete` `"c1"`
- **WHEN** a test renders `ChildrenList` (`children-list.test.ts`)
- **THEN** the markup contains one "Confirm delete" button inside a form with a hidden `id` input `c1`, the text "Minh" in the confirmation, and "This also deletes its devices and usage history."
- **AND** it contains a "Cancel" link to `/dashboard/children` and no "Confirm delete" for `An`

#### Scenario: Cancel deletes nothing
- **GIVEN** the confirmation view of `c1` and a stub delete action
- **WHEN** a test renders `ChildrenList` and follows Cancel, that is renders it again with `confirmDelete` `null` (`children-list.test.ts`)
- **THEN** the stub delete action was never called and the markup shows `Minh` and `An` with no confirmation form

#### Scenario: Confirm deletes
- **GIVEN** a fake client whose `children` delete resolves without error
- **WHEN** the delete action runs with the form data from the confirmation form, `id` = `c1` (`children.test.ts`)
- **THEN** `deleteChild` is called once and the client recorded `from("children").delete().eq("id", "c1")`

#### Scenario: Unknown confirmDelete id
- **GIVEN** children `Minh` (`c1`) and `confirmDelete` `"other"`
- **WHEN** a test renders `ChildrenList` (`children-list.test.ts`)
- **THEN** no confirmation form is rendered

### Requirement: List children
`listChildren(client)` SHALL return the family's children (as limited by RLS) ordered by `created_at`, or an empty list on error.

#### Scenario: Ordered list
- **GIVEN** a fake client resolving `[{ id: "c1", name: "Minh", created_at: "..." }, { id: "c2", name: "An", created_at: "..." }]`
- **WHEN** `listChildren(client)` is called (`children.test.ts`)
- **THEN** it returns those two children in that order
- **AND** the query was ordered by `created_at`

#### Scenario: Error gives an empty list
- **GIVEN** a fake client resolving a non-null `error`
- **WHEN** `listChildren(client)` is called (`children.test.ts`)
- **THEN** it returns `[]`

### Requirement: Children page markup
`ChildrenList` SHALL render an add form (name input, "Add child" button), and for each child its name, a rename form (name input, "Rename" button), a "Delete" link and a "Pair a device" button. With no children it SHALL show "No children yet". A given `error` string SHALL be shown.

#### Scenario: Children with controls
- **GIVEN** children `Minh` and `An`, no codes, no error and no `confirmDelete`
- **WHEN** a test renders `ChildrenList` (`children-list.test.ts`)
- **THEN** the markup contains `Minh`, `An`, one "Add child" button, two each of "Rename" buttons and "Delete" links, and two "Pair a device" buttons
- **AND** every name input has `maxlength="50"` and `required`

#### Scenario: Empty state and error
- **GIVEN** no children and error `"Name must be 1 to 50 characters"`
- **WHEN** a test renders `ChildrenList` (`children-list.test.ts`)
- **THEN** the markup contains "No children yet" and "Name must be 1 to 50 characters"
- **AND** it contains the "Add child" button
