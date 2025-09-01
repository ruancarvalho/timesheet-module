import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { of } from 'rxjs';
import { catchError, concatMap, exhaustMap, switchMap, tap } from 'rxjs/operators';
import {
  DateYMD,
  MDValue,
  TaskRef,
  TimesheetEntry,
  TimesheetStatus,
  TimesheetWeek,
  UserRef,
  ValidationIssue,
  WeekId,
} from '../models/timesheet.models';
import { TimesheetService } from '../services/timesheet.service';

export interface TimesheetStoreState {
  contextUser: UserRef | null;
  week: WeekId | null;
  status: TimesheetStatus;
  version: string;
  datesInWeek: DateYMD[];
  entries: TimesheetEntry[];
  selectedTaskIds: string[];
  tasksById: Record<string, TaskRef>;
  cellByTaskDate: Record<string, Record<string, MDValue>>; // taskId -> date -> value
  totalsPerDay: Record<string, number>;
  totalsPerTask: Record<string, number>;
  weekTotal: number;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error?: { code: string; message: string } | null;
}

const initialState: TimesheetStoreState = {
  contextUser: null,
  week: null,
  status: 'draft',
  version: '',
  datesInWeek: [],
  entries: [],
  selectedTaskIds: [],
  tasksById: {},
  cellByTaskDate: {},
  totalsPerDay: {},
  totalsPerTask: {},
  weekTotal: 0,
  loading: false,
  saving: false,
  dirty: false,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class TimesheetStore extends ComponentStore<TimesheetStoreState> {
  constructor(private api: TimesheetService) {
    super(initialState);
  }

  // =================== selectors ===================
  readonly vm$ = this.select((s) => ({
    week: s.week,
    status: s.status,
    version: s.version,
    dates: s.datesInWeek,
    rowOrder: s.selectedTaskIds,
    taskById: s.tasksById,
    cellByTaskDate: s.cellByTaskDate,
    totals: { perDay: s.totalsPerDay, perTask: s.totalsPerTask, weekTotal: s.weekTotal },
    loading: s.loading,
    saving: s.saving,
    dirty: s.dirty,
    error: s.error,
  }));

  readonly validation$ = this.select((s) => {
    const issues: ValidationIssue[] = [];
    for (const [date, total] of Object.entries(s.totalsPerDay)) {
      if (total > 1) {
        issues.push({
          kind: 'DayOverCapacity',
          message: `${date} exceeds 1.0 (${total})`,
          context: { date, dayTotal: total },
        });
      }
    }
    return { isValid: issues.length === 0, issues };
  });

  // =================== updaters ===================
  readonly setLoading = this.updater<boolean>((s, loading) => ({ ...s, loading }));
  readonly setSaving = this.updater<boolean>((s, saving) => ({ ...s, saving }));
  readonly setDirty = this.updater<boolean>((s, dirty) => ({ ...s, dirty }));
  readonly setError = this.updater<{ code: string; message: string } | null>((s, error) => ({ ...s, error }));

  readonly setContextUser = this.updater<UserRef | null>((s, user) => ({ ...s, contextUser: user }));
  readonly setWeek = this.updater<WeekId | null>((s, week) => ({ ...s, week }));
  readonly setStatus = this.updater<TimesheetStatus>((s, status) => ({ ...s, status }));
  readonly setVersion = this.updater<string>((s, version) => ({ ...s, version }));

  readonly loadSuccess = this.updater<TimesheetWeek>((s, ws) => {
    const { entries, datesInWeek } = ws;
    const { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, selectedTaskIds, tasksById } = buildIndexes(entries);
    return {
      ...s,
      status: ws.status,
      version: ws.version,
      datesInWeek,
      entries,
      selectedTaskIds,
      tasksById,
      cellByTaskDate,
      totalsPerDay,
      totalsPerTask,
      weekTotal,
      loading: false,
      dirty: false,
      error: null,
    };
  });

  readonly loadFailure = this.updater<{ code: string; message: string }>((s, e) => ({
    ...s,
    loading: false,
    error: e,
  }));

  readonly addTask = this.updater<TaskRef>((s, task) => {
    if (s.selectedTaskIds.includes(task.taskId)) return s;
    const tasksById = { ...s.tasksById, [task.taskId]: task };
    const selectedTaskIds = [...s.selectedTaskIds, task.taskId];
    const cellByTaskDate = { ...s.cellByTaskDate, [task.taskId]: s.cellByTaskDate[task.taskId] || {} };
    return { ...s, tasksById, selectedTaskIds, cellByTaskDate, dirty: true };
  });

  readonly removeTask = this.updater<string>((s, taskId) => {
    if (!s.selectedTaskIds.includes(taskId)) return s;
    const entries = s.entries.filter((e) => e.taskId !== taskId);
    const { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, selectedTaskIds, tasksById } = buildIndexes(entries);
    return {
      ...s,
      entries,
      cellByTaskDate,
      totalsPerDay,
      totalsPerTask,
      weekTotal,
      selectedTaskIds,
      tasksById,
      dirty: true,
    };
  });

  readonly clearRow = this.updater<string>((s, taskId) => {
    const entries = s.entries.filter((e) => e.taskId !== taskId);
    const { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal } = buildIndexes(
      entries,
      s.selectedTaskIds,
      s.tasksById
    );
    return { ...s, entries, cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, dirty: true };
  });

  readonly setEntryValue = this.updater<{ taskId: string; date: DateYMD; value: MDValue }>((s, { taskId, date, value }) => {
    const old = s.cellByTaskDate[taskId]?.[date] ?? 0;
    if (old === value) return s;

    // Update entries (upsert/remove)
    let entries: TimesheetEntry[];
    if (value === 0) {
      entries = s.entries.filter((e) => !(e.taskId === taskId && e.date === date));
    } else {
      let replaced = false;
      entries = s.entries.map((e) => {
        if (e.taskId === taskId && e.date === date) {
          replaced = true;
          return { ...e, value };
        }
        return e;
      });
      if (!replaced) entries = [...entries, { taskId, date, value }];
    }

    // Delta totals
    const delta = (value as number) - (old as number);
    const totalsPerDay = { ...s.totalsPerDay, [date]: (s.totalsPerDay[date] || 0) + delta };
    const totalsPerTask = { ...s.totalsPerTask, [taskId]: (s.totalsPerTask[taskId] || 0) + delta };
    const weekTotal = s.weekTotal + delta;

    // Cell map
    const cellByTaskDate = { ...s.cellByTaskDate };
    cellByTaskDate[taskId] = { ...(cellByTaskDate[taskId] || {}) };
    if (value === 0) delete cellByTaskDate[taskId][date];
    else cellByTaskDate[taskId][date] = value;

    // Ensure row exists in UI
    const selectedTaskIds = s.selectedTaskIds.includes(taskId) ? s.selectedTaskIds : [...s.selectedTaskIds, taskId];

    return {
      ...s,
      entries,
      totalsPerDay,
      totalsPerTask,
      weekTotal,
      cellByTaskDate,
      selectedTaskIds,
      dirty: true,
    };
  });

  readonly bulkSet = this.updater<{ taskId: string; dates: DateYMD[]; value: MDValue }>((s, { taskId, dates, value }) => {
    let entries = s.entries.slice();
    let totalsPerDay = { ...s.totalsPerDay } as Record<string, number>;
    let totalsPerTask = { ...s.totalsPerTask } as Record<string, number>;
    let cellByTaskDate = {
      ...s.cellByTaskDate,
      [taskId]: { ...(s.cellByTaskDate[taskId] || {}) },
    } as Record<string, Record<string, MDValue>>;
    let weekTotal = s.weekTotal;

    for (const date of dates) {
      const old = (cellByTaskDate[taskId][date] ?? 0) as number;
      if (old === (value as number)) continue;

      if (value === 0) {
        entries = entries.filter((e) => !(e.taskId === taskId && e.date === date));
        delete cellByTaskDate[taskId][date];
      } else {
        let replaced = false;
        entries = entries.map((e) => {
          if (e.taskId === taskId && e.date === date) {
            replaced = true;
            return { ...e, value };
          }
          return e;
        });
        if (!replaced) entries.push({ taskId, date, value });
        cellByTaskDate[taskId][date] = value;
      }

      const delta = (value as number) - old;
      totalsPerDay[date] = (totalsPerDay[date] || 0) + delta;
      totalsPerTask[taskId] = (totalsPerTask[taskId] || 0) + delta;
      weekTotal += delta;
    }

    const selectedTaskIds = s.selectedTaskIds.includes(taskId) ? s.selectedTaskIds : [...s.selectedTaskIds, taskId];

    return { ...s, entries, totalsPerDay, totalsPerTask, weekTotal, cellByTaskDate, selectedTaskIds, dirty: true };
  });

  readonly reorderRows = this.updater<{ fromIndex: number; toIndex: number }>((s, { fromIndex, toIndex }) => {
    const next = [...s.selectedTaskIds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return { ...s, selectedTaskIds: next };
  });

  readonly applyDraftReplacement = this.updater<TimesheetWeek>((s, draft) => {
    const { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, selectedTaskIds, tasksById } = buildIndexes(draft.entries);
    return {
      ...s,
      status: draft.status,
      version: draft.version,
      datesInWeek: draft.datesInWeek,
      entries: draft.entries,
      cellByTaskDate,
      totalsPerDay,
      totalsPerTask,
      weekTotal,
      selectedTaskIds,
      tasksById,
      dirty: true,
    };
  });

  readonly reset = this.updater<void>(() => initialState);

  // =================== effects ===================

  /** Load a week. Falls back to a DEV mock if the HTTP call fails (404, etc.) */
  readonly loadWeekEffect = this.effect<{ userId: string; week: WeekId }>((source$) =>
    source$.pipe(
      tap(() => this.setLoading(true)),
      switchMap(({ userId, week }) =>
        this.api.loadWeek(userId, week).pipe(
          tap((res) => this.loadSuccess(res)),
          catchError(() => {
            const ctx = this.get();
            const mock = generateMockWeek(userId || ctx.contextUser?.userId || 'me', week, ctx.contextUser || undefined);
            this.loadSuccess(mock);
            return of(null);
          }),
          tap(() => this.setLoading(false))
        )
      )
    )
  );

  /** Save Draft. If HTTP fails, simulates success by bumping version and clearing dirty. */
  readonly saveDraftEffect = this.effect<void>((trigger$) =>
    trigger$.pipe(
      exhaustMap(() => {
        const s = this.get();
        if (!s.contextUser || !s.week) return of(null);
        if (s.saving || !s.dirty) return of(null);

        this.setSaving(true);
        const payload: TimesheetWeek = {
          week: s.week,
          forUser: s.contextUser,
          status: 'draft',
          version: s.version,
          datesInWeek: s.datesInWeek,
          entries: s.entries,
        };

        return this.api.saveDraft(payload).pipe(
          tap((r) => {
            this.setVersion(r.version);
            this.setDirty(false);
          }),
          catchError(() => {
            // DEV MOCK: pretend success
            this.setVersion('W/"mock-save-1"');
            this.setDirty(false);
            return of(null);
          }),
          tap(() => this.setSaving(false))
        );
      })
    )
  );

  /** Submit. If HTTP fails, simulates success by setting submitted + bumping version. */
  readonly submitEffect = this.effect<void>((trigger$) =>
    trigger$.pipe(
      concatMap(() => {
        const s = this.get();
        if (!s.contextUser || !s.week) return of(null);
        const anyOver = Object.values(s.totalsPerDay).some((t) => t > 1);
        if (anyOver) return of(null);

        this.setSaving(true);
        return this.api.submit(s.contextUser.userId, s.week, s.version).pipe(
          tap((r) => {
            this.setStatus(r.status);
            this.setVersion(r.version);
            this.setDirty(false);
          }),
          catchError(() => {
            // DEV MOCK: pretend success
            this.setStatus('submitted');
            this.setVersion('W/"mock-submit-1"');
            this.setDirty(false);
            return of(null);
          }),
          tap(() => this.setSaving(false))
        );
      })
    )
  );

  /** Optional: Apply a template. If HTTP fails, fills with a mock draft. */
  readonly applyTemplateEffect = this.effect<{ templateId: string }>((source$) =>
    source$.pipe(
      switchMap(({ templateId }) => {
        const s = this.get();
        if (!s.contextUser || !s.week) return of(null);
        return this.api.applyTemplate({ userId: s.contextUser.userId, week: s.week, templateId }).pipe(
          tap((r) => this.applyDraftReplacement(r.draft)),
          catchError(() => {
            const mock = generateMockWeek(s.contextUser!.userId, s.week!, s.contextUser!);
            this.applyDraftReplacement(mock);
            return of(null);
          })
        );
      })
    )
  );

  /** Optional: Copy last week. If HTTP fails, fills with a mock draft. */
  readonly copyLastWeekEffect = this.effect<{ mode: 'structure_only' | 'structure_and_values' }>((source$) =>
    source$.pipe(
      switchMap(({ mode }) => {
        const s = this.get();
        if (!s.contextUser || !s.week) return of(null);
        const sourceWeek: WeekId = { isoYear: s.week.isoYear, isoWeek: Math.max(1, s.week.isoWeek - 1) };
        return this.api.copyLastWeek({ userId: s.contextUser.userId, source: sourceWeek, target: s.week, mode }).pipe(
          tap((r) => this.applyDraftReplacement(r.draft)),
          catchError(() => {
            const mock = generateMockWeek(s.contextUser!.userId, s.week!, s.contextUser!);
            this.applyDraftReplacement(mock);
            return of(null);
          })
        );
      })
    )
  );
}

// =================== helpers ===================
function buildIndexes(
  entries: TimesheetEntry[],
  keepRowOrder?: string[],
  keepTasks?: Record<string, TaskRef>
): {
  cellByTaskDate: Record<string, Record<string, MDValue>>;
  totalsPerDay: Record<string, number>;
  totalsPerTask: Record<string, number>;
  weekTotal: number;
  selectedTaskIds: string[];
  tasksById: Record<string, TaskRef>;
} {
  const cellByTaskDate: Record<string, Record<string, MDValue>> = {};
  const totalsPerDay: Record<string, number> = {};
  const totalsPerTask: Record<string, number> = {};
  const taskOrder: string[] = keepRowOrder ? [...keepRowOrder] : [];
  const tasksById: Record<string, TaskRef> = keepTasks ? { ...keepTasks } : {};
  let weekTotal = 0;

  for (const e of entries) {
    if (!cellByTaskDate[e.taskId]) cellByTaskDate[e.taskId] = {};
    cellByTaskDate[e.taskId][e.date] = e.value;
    totalsPerDay[e.date] = (totalsPerDay[e.date] || 0) + e.value;
    totalsPerTask[e.taskId] = (totalsPerTask[e.taskId] || 0) + e.value;
    weekTotal += e.value;
    if (!taskOrder.includes(e.taskId)) taskOrder.push(e.taskId);
  }

  return { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, selectedTaskIds: taskOrder, tasksById };
}

// --- DEV MOCKS ---
function generateMockWeek(userId: string, week: WeekId, user?: UserRef): TimesheetWeek {
  const datesInWeek = isoWeekToDates(week.isoYear, week.isoWeek);
  const entries: TimesheetEntry[] = [
    { taskId: 'T-101', date: datesInWeek[0], value: 0.5 },
    { taskId: 'T-101', date: datesInWeek[1], value: 0.5 },
    { taskId: 'T-101', date: datesInWeek[2], value: 0.25 },
    { taskId: 'T-202', date: datesInWeek[2], value: 0.5 },
    { taskId: 'T-202', date: datesInWeek[4], value: 1 },
  ];
  return {
    week,
    forUser: user || { userId, displayName: 'Mock User', timezone: 'Europe/Lisbon' },
    status: 'draft',
    version: 'W/"mock-load-1"',
    datesInWeek,
    entries,
    lastModifiedBy: user,
    lastModifiedAt: new Date().toISOString(),
  };
}

function isoWeekToDates(isoYear: number, isoWeek: number): DateYMD[] {
  // ISO week date: week 1 is the week with Jan 4th. Monday = day 1.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1..7 where 1=Mon, 7=Sun
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (isoWeek - 1) * 7);

  const days: DateYMD[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10)); // 'YYYY-MM-DD'
  }
  return days;
}
