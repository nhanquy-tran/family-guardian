## ADDED Requirements

### Requirement: Dashboard server actions are covered by tests
Every exported server action under `apps/web/src/app/dashboard/**/actions.ts` SHALL have unit tests for its success path and its validation and store-error paths. Actions whose lib detects a signed-out user (`addChild`, devices, settings, `removeBlockRule`) SHALL also be tested without a session. A failing action MUST redirect to its error URL, never its success URL.

#### Scenario: Children actions pass the form and redirect
- **GIVEN** the real `lib/children` with a fake session client that produces success, a validation error and a store error
- **WHEN** `addChildAction`, `renameChildAction`, `deleteChildAction` and `createCodeAction` run with form data (`apps/web/src/app/dashboard/children/actions.test.ts`)
- **THEN** each passes the form values to its lib function, revalidates and redirects to `/dashboard/children` on success, and on failure redirects to `/dashboard/children?error=<encoded message>` (`?pairError=<childId>&reason=<reason>` for the code action) without revalidating

#### Scenario: Children action without a session
- **GIVEN** a client whose `parents` lookup returns no row
- **WHEN** `addChildAction` runs with a valid name (`apps/web/src/app/dashboard/children/actions.test.ts`)
- **THEN** it redirects to `/dashboard/children?error=No%20family%20for%20this%20account` and no insert is made

#### Scenario: Other detecting actions without a session
- **GIVEN** a client with no session (no family, zero rows changed)
- **WHEN** the device actions, the settings actions and `removeRuleAction` run (`apps/web/src/app/dashboard/devices/actions.test.ts`, `settings/actions.test.ts`, `children/[childId]/rules/actions.test.ts`)
- **THEN** each redirects to its error URL and never to its success URL

#### Scenario: Missing form fields become empty strings
- **WHEN** an action runs with an empty `FormData` (`apps/web/src/app/dashboard/categories/actions.test.ts`)
- **THEN** the lib function receives `""` for each field and the action redirects to its error URL

#### Scenario: Category actions
- **GIVEN** `saveCategoryOverride` and `removeCategoryOverride` returning success and an error code
- **WHEN** `saveAction` and `removeAction` run (`apps/web/src/app/dashboard/categories/actions.test.ts`)
- **THEN** success revalidates and redirects to `/dashboard/categories`, an error redirects to `/dashboard/categories?error=<code>`

#### Scenario: Device actions
- **GIVEN** `renameDevice` and `removeDevice` returning success, `invalid-name` and `failed`
- **WHEN** `renameDeviceAction` and `removeDeviceAction` run (`apps/web/src/app/dashboard/devices/actions.test.ts`)
- **THEN** both call `revalidatePath("/dashboard/devices")` on success and on failure, and redirect to `/dashboard/devices` on success or to `?error=<code>` on failure

#### Scenario: Digest settings parsing
- **GIVEN** `saveDigestSettings` spied
- **WHEN** `saveDigestSettingsAction` runs with `hour` empty and with `hour` `"8"` (`apps/web/src/app/dashboard/settings/actions.test.ts`)
- **THEN** it passes `NaN` and `8` respectively, with `frequency` and `timezone`

#### Scenario: Settings redirects
- **GIVEN** the settings lib functions returning success, `invalid` and `failed`
- **WHEN** `saveDigestSettingsAction` and `saveWeeklyReportAction` run (`apps/web/src/app/dashboard/settings/actions.test.ts`)
- **THEN** `revalidatePath` is called on success and on failure, success redirects to `/dashboard/settings?saved=1`, failure to `/dashboard/settings?error=<code>`, and `weekly_report=on` maps to `true`, any other value to `false`

#### Scenario: Timezone capture
- **WHEN** `captureTimezoneAction("Europe/Berlin")` runs (`apps/web/src/app/dashboard/settings/actions.test.ts`)
- **THEN** `captureFamilyTimezone` receives that value and nothing is redirected

#### Scenario: Rules actions
- **GIVEN** `addDomainRule`, `addCategoryRule` and `removeBlockRule` returning success, `invalid_domain`, `invalid_category`, `duplicate`, `not_found` and `failed`
- **WHEN** `addDomainAction`, `addCategoryAction` and `removeRuleAction` run for child `c 1` (`apps/web/src/app/dashboard/children/[childId]/rules/actions.test.ts`)
- **THEN** success revalidates and redirects to `/dashboard/children/c%201/rules`, failure redirects to `.../rules?error=<code>`

#### Scenario: Limits and allowed-hours actions
- **GIVEN** `saveDailyLimits` and `saveAllowedHours` returning success and an error
- **WHEN** `saveLimitsAction` and `saveAllowedHoursAction` run (`apps/web/src/app/dashboard/children/[childId]/rules/actions.test.ts`)
- **THEN** limits receive one `limit_<category>` value per shared category, hours receive `allowed_start` and `allowed_end`, success redirects to the rules page, and errors redirect to `?limitsError=<code>` and `?hoursError=<code>`

#### Scenario: Homework actions
- **GIVEN** the homework lib functions returning success and each error code
- **WHEN** `saveCategoriesAction`, `addDomainAction` and `removeDomainAction` run (`apps/web/src/app/dashboard/children/[childId]/homework/actions.test.ts`)
- **THEN** all `category` values are passed as a list, success revalidates the homework page and `/dashboard` and redirects to the homework page, and each error redirects to `.../homework?error=<code>`

#### Scenario: Store error in an action
- **GIVEN** a fake client whose query returns a database error
- **WHEN** `renameChildAction` runs with valid input (`apps/web/src/app/dashboard/children/actions.test.ts`)
- **THEN** it redirects to `/dashboard/children?error=` with the generic message and the success URL is never reached

### Requirement: Actions cannot change another family's rows
For every table a dashboard server action writes (`children`, `block_rules`, `child_category_limits`, `domain_categories`, `devices`, `pairing_codes`, `families`), a parent of another family SHALL change zero rows or be rejected by RLS, and the rows SHALL stay unchanged.

#### Scenario: Parent of another family cannot write action tables
- **GIVEN** two seeded families A and B, each with a child, device, rule, daily limit, family category override and pairing code
- **WHEN** parent A issues the update, insert and delete statements the actions use against B's rows, including the homework and allowed-hours columns of `children`, B's digest and weekly-report settings in `families`, and `pairing_codes` for B's child (`supabase/tests/dashboard-actions-rls.test.ts`)
- **THEN** each statement affects zero rows or fails with an RLS violation, and a service-role read shows every B row unchanged
