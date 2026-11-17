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
- **WHEN** `renameChild(client, "child-1", " An ")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: true }`
- **AND** the client recorded `from("children").update({ name: "An" }).eq("id", "child-1")` and no other write

#### Scenario: Rename with invalid name
- **WHEN** `renameChild(client, "child-1", "")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: false, error: "Name must be 1 to 50 characters" }` and no update was made

### Requirement: Delete a child
`deleteChild(client, id)` SHALL delete the child row with that `id`; its devices and pairing codes are removed by the database cascade from issue #7.

#### Scenario: Delete by id
- **WHEN** `deleteChild(client, "child-1")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: true }`
- **AND** the client recorded `from("children").delete().eq("id", "child-1")`

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
`ChildrenList` SHALL render an add form (name input, "Add child" button), and for each child its name, a rename form (name input, "Rename" button), a "Delete" button and a "Pair a device" button. With no children it SHALL show "No children yet". A given `error` string SHALL be shown.

#### Scenario: Children with controls
- **WHEN** a test renders `ChildrenList` with children `Minh` and `An`, no codes and no error (`children-list.test.ts`)
- **THEN** the markup contains `Minh`, `An`, one "Add child" button, and two each of "Rename", "Delete" and "Pair a device" buttons
- **AND** every name input has `maxlength="50"` and `required`

#### Scenario: Empty state and error
- **WHEN** a test renders `ChildrenList` with no children and error `"Name must be 1 to 50 characters"` (`children-list.test.ts`)
- **THEN** the markup contains "No children yet" and "Name must be 1 to 50 characters"
- **AND** it contains the "Add child" button
