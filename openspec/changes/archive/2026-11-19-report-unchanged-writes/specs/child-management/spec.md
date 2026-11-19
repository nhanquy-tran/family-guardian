## MODIFIED Requirements

### Requirement: Rename a child
`renameChild(client, id, name)` SHALL apply the same name validation and update only `name` of the child with that `id`. It SHALL ask for the updated row ids and return `{ ok: false, error: "Child not found" }` when no row was updated.

#### Scenario: Rename updates only the name
- **GIVEN** a fake client whose `children` update resolves one row without error
- **WHEN** `renameChild(client, "child-1", " An ")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: true }`
- **AND** the client recorded `from("children").update({ name: "An" }).eq("id", "child-1").select("id")` and no other write

#### Scenario: Rename with invalid name
- **GIVEN** a fake client that records writes
- **WHEN** `renameChild(client, "child-1", "")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: false, error: "Name must be 1 to 50 characters" }` and no update was made

#### Scenario: Rename database error is reported
- **GIVEN** a fake client whose `children` update resolves a non-null `error`
- **WHEN** `renameChild(client, "child-1", "An")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: false }` with a non-empty `error` that does not contain the database error message

#### Scenario: Rename of a child the parent cannot see
- **GIVEN** a fake client whose `children` update resolves no rows and no error (RLS matched nothing)
- **WHEN** `renameChild(client, "child-9", "An")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: false, error: "Child not found" }`

### Requirement: Delete a child
`deleteChild(client, id)` SHALL delete the child row with that `id`; its devices and pairing codes are removed by the database cascade from issue #7. It SHALL ask for the deleted row ids and return `{ ok: false, error: "Child not found" }` when no row was deleted.

#### Scenario: Delete by id
- **GIVEN** a fake client whose `children` delete resolves one row without error
- **WHEN** `deleteChild(client, "child-1")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: true }`
- **AND** the client recorded `from("children").delete().eq("id", "child-1").select("id")`

#### Scenario: Delete database error is reported
- **GIVEN** a fake client whose `children` delete resolves a non-null `error`
- **WHEN** `deleteChild(client, "child-1")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: false }` with a non-empty `error` that does not contain the database error message

#### Scenario: Delete of a child the parent cannot see
- **GIVEN** a fake client whose `children` delete resolves no rows and no error (RLS matched nothing)
- **WHEN** `deleteChild(client, "child-9")` is called (`children.test.ts`)
- **THEN** it returns `{ ok: false, error: "Child not found" }`
