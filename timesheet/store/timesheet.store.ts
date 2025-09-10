import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { forkJoin, of } from 'rxjs';
import { catchError, concatMap, exhaustMap, switchMap, tap } from 'rxjs/operators';
import {
  DateYMD,
  DayMetaMap,
  MDValue,
  TaskRef,
  TimesheetEntry,
  TimesheetStatus,
  TimesheetWeek,
  UserRef,
  ValidationIssue,
  WeekId,
  WeekNavItem,
} from '../models/timesheet.models';
import { TimesheetService } from '../services/timesheet.service';
import { CalendarService } from '../services/calendar.service';

export interface TimesheetStoreState {
  contextUser: UserRef | null;
  week: WeekId | null;

  // frame
  status: TimesheetStatus;
  version: string;
  datesInWeek: DateYMD[];
  forUser?: UserRef;

  // data
  entries: TimesheetEntry[];
  tasksById: Record<string, TaskRef>;
  selectedTaskIds: string[];

  // derived
  cellByTaskDate: Record<string, Record<string, MDValue>>;
  totalsPerDay: Record<string, number>;
  totalsPerTask: Record<string, number>;
  weekTotal: number;

  // calendar & nav
  dayMeta: DayMetaMap;
  blockedDates: Record<DateYMD, true>;
  weekNav: WeekNavItem[];

  // ui
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
  forUser: undefined,

  entries: [],
  tasksById: {},
  selectedTaskIds: [],

  cellByTaskDate: {},
  totalsPerDay: {},
  totalsPerTask: {},
  weekTotal: 0,

  dayMeta: {},
  blockedDates: {},
  weekNav: [],

  loading: false,
  saving: false,
  dirty: false,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class TimesheetStore extends ComponentStore<TimesheetStoreState> {
  constructor(private api: TimesheetService, private cal: CalendarService) {
    super(initialState);
  }

  // ============ selectors ============
  readonly vm$ = this.select((s) => ({
    week: s.week,
    status: s.status,
    version: s.version,
    dates: s.datesInWeek,
    rowOrder: s.selectedTaskIds,
    taskById: s.tasksById,
    cellByTaskDate: s.cellByTaskDate,
    totals: { perDay: s.totalsPerDay, perTask: s.totalsPerTask, weekTotal: s.weekTotal },
    dayMeta: s.dayMeta,
    blockedDates: s.blockedDates,
    weekNav: s.weekNav,
    loading: s.loading,
    saving: s.saving,
    dirty: s.dirty,
    error: s.error,
  }));

  readonly validation$ = this.select((s) => {
    const issues: ValidationIssue[] = [];
    for (const [date, total] of Object.entries(s.totalsPerDay)) {
      if (total > 1) issues.push({ kind: 'DayOverCapacity', message: `${date} exceeds 1.0 (${total})`, context: { date, dayTotal: total } });
    }
    return { isValid: issues.length === 0, issues };
  });

  // ============ updaters ============
  readonly setLoading = this.updater<boolean>((s, loading) => ({ ...s, loading }));
  readonly setSaving = this.updater<boolean>((s, saving) => ({ ...s, saving }));
  readonly setDirty = this.updater<boolean>((s, dirty) => ({ ...s, dirty }));
  readonly setError = this.updater<{ code: string; message: string } | null>((s, error) => ({ ...s, error }));

  readonly setContextUser = this.updater<UserRef | null>((s, user) => ({ ...s, contextUser: user }));
  readonly setWeek = this.updater<WeekId | null>((s, week) => ({ ...s, week }));
  readonly setStatus = this.updater<TimesheetStatus>((s, status) => ({ ...s, status }));
  readonly setVersion = this.updater<string>((s, version) => ({ ...s, version }));

  /** Frame-only: set metadata (no entries or derived indexes). */
  readonly applyWeekFrame = this.updater<Pick<TimesheetWeek, 'forUser' | 'status' | 'version' | 'datesInWeek'>>((s, f) => ({
    ...s,
    forUser: f.forUser ?? s.forUser,
    status: f.status,
    version: f.version,
    datesInWeek: f.datesInWeek,
    // reset per-week volatile bits until entries/meta arrive
    entries: [],
    cellByTaskDate: {},
    totalsPerDay: {},
    totalsPerTask: {},
    weekTotal: 0,
    dayMeta: {},
    blockedDates: {},
    weekNav: s.weekNav, // leave nav as-is until fetched
    dirty: false,
    error: null,
  }));

  /** Replace tasks dictionary. */
  readonly setTasksDictionary = this.updater<Record<string, TaskRef>>((s, dict) => ({
    ...s,
    tasksById: { ...dict },
  }));

  /** Entries-only update: rebuild indexes and totals. */
  readonly applyEntriesSuccess = this.updater<TimesheetEntry[]>((s, entries) => {
    const { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, selectedTaskIds } = buildIndexes(entries, s.selectedTaskIds, s.tasksById);
    return {
      ...s,
      entries,
      cellByTaskDate,
      totalsPerDay,
      totalsPerTask,
      weekTotal,
      selectedTaskIds,
      dirty: false,
      error: null,
    };
  });

  readonly setWeekNav = this.updater<WeekNavItem[]>((s, items) => ({ ...s, weekNav: items || [] }));

  /** Day meta (weekend/holiday) and derived blocked dates. */
  readonly setDayMeta = this.updater<DayMetaMap>((s, meta) => {
    const blocked: Record<DateYMD, true> = {};
    for (const d of s.datesInWeek) {
      const info = meta[d];
      if (info && (info.isWeekend || info.isHoliday)) blocked[d] = true as const;
    }
    return { ...s, dayMeta: meta, blockedDates: blocked };
  });

  // Existing row/task/value updaters remain as you had them:
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
    return { ...s, entries, cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, selectedTaskIds, tasksById, dirty: true };
  });

  readonly clearRow = this.updater<string>((s, taskId) => {
    const entries = s.entries.filter((e) => e.taskId !== taskId);
    const { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal } = buildIndexes(entries, s.selectedTaskIds, s.tasksById);
    return { ...s, entries, cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, dirty: true };
  });

  readonly setEntryValue = this.updater<{ taskId: string; date: DateYMD; value: MDValue }>((s, { taskId, date, value }) => {
    const old = s.cellByTaskDate[taskId]?.[date] ?? 0;
    if (old === value) return s;

    let entries: TimesheetEntry[];
    if (value === 0) {
      entries = s.entries.filter((e) => !(e.taskId === taskId && e.date === date));
    } else {
      let replaced = false;
      entries = s.entries.map((e) => (e.taskId === taskId && e.date === date ? ((replaced = true), { ...e, value }) : e));
      if (!replaced) entries = [...entries, { taskId, date, value }];
    }

    const delta = (value as number) - (old as number);
    const totalsPerDay = { ...s.totalsPerDay, [date]: (s.totalsPerDay[date] || 0) + delta };
    const totalsPerTask = { ...s.totalsPerTask, [taskId]: (s.totalsPerTask[taskId] || 0) + delta };
    const weekTotal = s.weekTotal + delta;

    const cellByTaskDate = { ...s.cellByTaskDate, [taskId]: { ...(s.cellByTaskDate[taskId] || {}) } };
    if (value === 0) delete cellByTaskDate[taskId][date]; else cellByTaskDate[taskId][date] = value;

    const selectedTaskIds = s.selectedTaskIds.includes(taskId) ? s.selectedTaskIds : [...s.selectedTaskIds, taskId];

    return { ...s, entries, totalsPerDay, totalsPerTask, weekTotal, cellByTaskDate, selectedTaskIds, dirty: true };
  });

  readonly bulkSet = this.updater<{ taskId: string; dates: DateYMD[]; value: MDValue }>((s, { taskId, dates, value }) => {
    let entries = s.entries.slice();
    let totalsPerDay = { ...s.totalsPerDay } as Record<string, number>;
    let totalsPerTask = { ...s.totalsPerTask } as Record<string, number>;
    let cellByTaskDate = { ...s.cellByTaskDate, [taskId]: { ...(s.cellByTaskDate[taskId] || {}) } } as Record<string, Record<string, MDValue>>;
    let weekTotal = s.weekTotal;

    for (const date of dates) {
      const old = (cellByTaskDate[taskId][date] ?? 0) as number;
      if (old === (value as number)) continue;

      if (value === 0) {
        entries = entries.filter((e) => !(e.taskId === taskId && e.date === date));
        delete cellByTaskDate[taskId][date];
      } else {
        let replaced = false;
        entries = entries.map((e) => (e.taskId === taskId && e.date === date ? ((replaced = true), { ...e, value }) : e));
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

  // ============ effects ============

  /** Full load with two-phase hydration:
   * 1) load frame (status/version/dates),
   * 2) parallel: tasks + entries + week-nav + day-meta,
   * 3) apply tasks → entries → week-nav → day-meta
   */
  readonly loadWeekEffect = this.effect<{ userId: string; week: WeekId }>((source$) =>
    source$.pipe(
      tap(() => this.setLoading(true)),
      switchMap(({ userId, week }) =>
        // Phase 1: Frame
        this.api.loadWeekFrame(userId, week).pipe(
          catchError(() => of(generateMockFrame(userId, week, this.get().contextUser || undefined))),
          tap((frame) => {
            this.setWeek(week);
            this.applyWeekFrame(frame);
          }),
          // Phase 2: Parallel fetches
          switchMap((frame) => {
            const dates = frame.datesInWeek && frame.datesInWeek.length ? frame.datesInWeek : this.get().datesInWeek;
            return forkJoin({
              tasks: this.api.loadTasksForWeek(userId, week).pipe(catchError(() => of([] as TaskRef[]))),
              entries: this.api.loadEntriesForWeek(userId, week).pipe(catchError(() => of([] as TimesheetEntry[]))),
              nav: this.api.getAdjacentWeeks(userId, week).pipe(
                catchError(() => of(fallbackWeekNav(week, frame.status || 'draft')))
              ),
              meta: this.cal.getWeekMeta(userId, week).pipe(
                catchError(() => of(computeWeekendOnlyMeta(dates)))
              ),
            });
          }),
          // Phase 3: Apply in order
          tap(({ tasks, entries, nav, meta }) => {
            const dict = buildTaskDictWithPlaceholders(tasks, entries);
            this.setTasksDictionary(dict);
            this.applyEntriesSuccess(normalizeEntries(entries));
            this.setWeekNav(nav);
            this.setDayMeta(meta);
          }),
          tap(() => this.setLoading(false))
        )
      )
    )
  );

  /** Save Draft. (Mocks still allowed upstream) */
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
            // DEV MOCK
            this.setVersion('W/"mock-save-1"');
            this.setDirty(false);
            return of(null);
          }),
          tap(() => this.setSaving(false))
        );
      })
    )
  );

  /** Submit. (Mocks still allowed upstream) */
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
            // Optimistically reflect in week-nav
            const nav = (this.get().weekNav || []).map((i) =>
              i.week.isoYear === s.week!.isoYear && i.week.isoWeek === s.week!.isoWeek ? { ...i, status: 'submitted' } : i
            );
            this.setWeekNav(nav);
          }),
          catchError(() => {
            // DEV MOCK
            this.setStatus('submitted');
            this.setVersion('W/"mock-submit-1"');
            this.setDirty(false);
            const nav = (this.get().weekNav || []).map((i) =>
              i.week.isoYear === s.week!.isoYear && i.week.isoWeek === s.week!.isoWeek ? { ...i, status: 'submitted' } : i
            );
            this.setWeekNav(nav);
            return of(null);
          }),
          tap(() => this.setSaving(false))
        );
      })
    )
  );
}

/* =================== helpers =================== */

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

/** Build tasks dict and ensure placeholders exist for any taskId referenced by entries. */
function buildTaskDictWithPlaceholders(tasks: TaskRef[], entries: TimesheetEntry[]): Record<string, TaskRef> {
  const dict: Record<string, TaskRef> = {};
  for (const t of tasks) dict[t.taskId] = t;
  for (const e of entries) {
    if (!dict[e.taskId]) {
      dict[e.taskId] = {
        taskId: e.taskId,
        name: '(Unknown task)',
        isActive: false,
        project: { projectId: 'unknown', name: 'Unknown Project', isActive: false, client: { clientId: 'unknown', name: 'Unknown Client' } },
      };
    }
  }
  return dict;
}

/** Normalize entries to FE rules (drop zeros, clamp to [0,1] step .25 if needed). */
function normalizeEntries(entries: TimesheetEntry[]): TimesheetEntry[] {
  const allowed = new Set([0, 0.25, 0.5, 0.75, 1]);
  const norm = (v: number) => {
    if (allowed.has(v as any)) return v as MDValue;
    const clamped = Math.min(1, Math.max(0, v));
    const stepped = Math.round(clamped / 0.25) * 0.25;
    return (allowed.has(stepped as any) ? (stepped as MDValue) : (0 as MDValue));
  };
  return entries
    .map((e) => ({ ...e, value: norm(e.value as number) }))
    .filter((e) => e.value !== 0);
}

/** Fallback week-nav if API fails: prev, current, next1, next2. */
function fallbackWeekNav(center: WeekId, status: TimesheetStatus): WeekNavItem[] {
  const prev = addIsoWeeks(center, -1);
  const next1 = addIsoWeeks(center, 1);
  const next2 = addIsoWeeks(center, 2);
  return [
    { key: 'prev', week: prev, status: 'draft' },
    { key: 'current', week: center, status },
    { key: 'next1', week: next1, status: 'draft' },
    { key: 'next2', week: next2, status: 'draft' },
  ];
}

function addIsoWeeks(week: WeekId, delta: number): WeekId {
  if (delta === 0) return week;
  let { isoYear, isoWeek } = week;
  let n = isoWeek + delta;
  if (delta > 0) {
    while (true) {
      const max = weeksInIsoYear(isoYear);
      if (n <= max) break;
      n -= max;
      isoYear += 1;
    }
  } else {
    while (n < 1) {
      isoYear -= 1;
      n += weeksInIsoYear(isoYear);
    }
  }
  return { isoYear, isoWeek: n };
}

function weeksInIsoYear(isoYear: number): number {
  const dec28 = new Date(Date.UTC(isoYear, 11, 28));
  return isoWeekFromDateUTC(dec28).isoWeek;
}

function isoWeekFromDateUTC(date: Date): WeekId {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const daysSinceYearStart = Math.floor((d.getTime() - yearStart.getTime()) / 86400000) + 1;
  const isoWeek = Math.ceil(daysSinceYearStart / 7);
  return { isoYear, isoWeek };
}

function computeWeekendOnlyMeta(dates: DateYMD[]): DayMetaMap {
  const m: DayMetaMap = {};
  for (const ymd of dates) {
    const dow = new Date(ymd + 'T00:00:00Z').getUTCDay(); // 0=Sun .. 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    m[ymd] = { isWeekend, isHoliday: false };
  }
  return m;
}

/* -------- DEV fallbacks for frame-only -------- */

function generateMockFrame(userId: string, week: WeekId, user?: UserRef): Pick<TimesheetWeek, 'forUser' | 'status' | 'version' | 'datesInWeek'> {
  return {
    forUser: user || { userId, displayName: 'Mock User', timezone: 'Europe/Lisbon' },
    status: 'draft',
    version: 'W/"mock-frame-1"',
    datesInWeek: isoWeekToDates(week.isoYear, week.isoWeek),
  };
}

function isoWeekToDates(isoYear: number, isoWeek: number): DateYMD[] {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (isoWeek - 1) * 7);

  const days: DateYMD[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
