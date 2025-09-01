 Keep the **store class** itself in one file so the public API stays easy to find. Here’s a practical split that pays off in testability and future migration (to signals) without adding noise.

# What to keep in `store/timesheet.store.ts`

* The **`TimesheetStore` class** (state shape, updaters, effects, selectors).
* Only **tiny** glue helpers that are truly store-internal.

# What to move out (no code, just file suggestions)

1. **Indexing & math (pure)**

   * `store/utils/indexes.ts`

     * `buildIndexes(entries, keepRowOrder?, keepTasks?)`
     * Any small delta helpers if you add them later
   * Why: pure, easy to unit-test; reused by updaters and effects.

2. **Validation (pure)**

   * `store/utils/validation.ts`

     * `validateTotals(totalsPerDay): ValidationReport`
     * Constants like `MAX_PER_DAY = 1`
   * Why: keeps business rules isolated; tests don’t need ComponentStore.

3. **ISO week/date helpers (pure)**

   * `store/utils/iso-week.ts`

     * `isoWeekToDates(isoYear, isoWeek)`
     * (Later) `addWeeks(week, n)`, `todayIsoWeek(tz?)`
   * Why: date math is noisy; isolate and test separately.

4. **Mocks (dev-only)**

   * `store/dev/generate-mock-week.ts`

     * `generateMockWeek(userId, week, user?)`
   * Optionally move **task search mocks** to `services/dev/mock-tasks.ts`.
   * Why: one toggle to exclude from prod builds (via environment imports or a simple conditional in the store).

5. **API adapters (if your backend DTOs are French)**

   * `store/adapters/timesheet.adapter.ts`

     * `fromApiTimesheet(dto): TimesheetWeek`
     * `toApiSaveDraft(week: TimesheetWeek): ApiPayload`
   * `store/adapters/task.adapter.ts`

     * `fromApiTask(dto): TaskRef`
   * Why: translation layer stays out of the store; easier to swap when API evolves.

6. **Constants**

   * `store/constants.ts`

     * `MD_VALUES: ReadonlyArray<MDValue> = [0, 0.25, 0.5, 0.75, 1]`
     * Status literals, feature key string, etc.
   * Why: avoid magic values sprinkled across components.

# Folder snapshot (target)

```
modules/timesheet/
  store/
    timesheet.store.ts
    utils/
      indexes.ts
      validation.ts
      iso-week.ts
    adapters/
      timesheet.adapter.ts
      task.adapter.ts
    dev/
      generate-mock-week.ts
    constants.ts
```

# Why this split is worth it

* **Tests**: you can unit-test `indexes`, `validation`, and `iso-week` in isolation (fast, deterministic).
* **Future migration**: when moving to `@ngrx/signals`, the store’s public API stays; these pure modules don’t change.
* **Prod safety**: dev mocks live in one place and can be stripped/guarded by an env flag.
* **Readability**: the store file focuses on “how state changes”, not on math or API translation.

# Optional (nice-to-have) wiring

* Add a `store/index.ts` barrel that only exports the `TimesheetStore`—encourages other files to depend on **public APIs** instead of utilities.
* If you want mocks without touching the store, consider a **Dev `HttpInterceptor`** or **`useClass` providers** for `TimesheetService` / `TaskService` in `TimesheetModule` when `environment.mock === true`.
