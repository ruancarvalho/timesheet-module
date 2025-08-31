# Timesheet Module – Angular 13 Scaffold

> Target stack: **Angular 13.3**, **Material 13**, **RxJS 7.5**, **@ngrx/component-store 13**, **Node 18.19.1**  
> Scope: feature module + routing, models, services, ComponentStore, page + 3 components (grid, week-nav, task-selector).  
> Note: minimal, compilable scaffolding with placeholders and TODOs. Fill API endpoints and styles per project.

---

## 📁 Folder Tree
```
src/app/modules/timesheet/
  timesheet.module.ts
  timesheet.routing.ts
  models/
    timesheet.models.ts
  services/
    timesheet.service.ts
    task.service.ts
  store/
    timesheet.store.ts
  timesheet-page/
    timesheet-page.component.ts
    timesheet-page.component.html
    timesheet-page.component.scss
  components/
    timesheet-grid/
      timesheet-grid.component.ts
      timesheet-grid.component.html
      timesheet-grid.component.scss
    timesheet-week-nav/
      timesheet-week-nav.component.ts
      timesheet-week-nav.component.html
      timesheet-week-nav.component.scss
    timesheet-task-selector/
      timesheet-task-selector.component.ts
      timesheet-task-selector.component.html
      timesheet-task-selector.component.scss
```

---

## 📦 `timesheet.module.ts`
```ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TimesheetRoutingModule } from './timesheet.routing';

// Angular Material
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

// Components
import { TimesheetPageComponent } from './timesheet-page/timesheet-page.component';
import { TimesheetGridComponent } from './components/timesheet-grid/timesheet-grid.component';
import { TimesheetWeekNavComponent } from './components/timesheet-week-nav/timesheet-week-nav.component';
import { TimesheetTaskSelectorComponent } from './components/timesheet-task-selector/timesheet-task-selector.component';

@NgModule({
  declarations: [
    TimesheetPageComponent,
    TimesheetGridComponent,
    TimesheetWeekNavComponent,
    TimesheetTaskSelectorComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    TimesheetRoutingModule,

    // Material
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressBarModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    MatDividerModule,
  ],
})
export class TimesheetModule {}
```

---

## 🧭 `timesheet.routing.ts`
```ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TimesheetPageComponent } from './timesheet-page/timesheet-page.component';

// NOTE: Using two params for week to avoid complex parsing in Angular 13 routing.
const routes: Routes = [
  { path: '', redirectTo: (new Date()).getFullYear() + '/' + 1, pathMatch: 'full' },
  { path: ':isoYear/:isoWeek', component: TimesheetPageComponent },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class TimesheetRoutingModule {}
```

---

## 📚 `models/timesheet.models.ts`
```ts
// Core types for the feature (FE-only shapes)

export type DateYMD = string; // 'YYYY-MM-DD'

export interface WeekId { isoYear: number; isoWeek: number; }

export type MDValue = 0 | 0.25 | 0.5 | 0.75 | 1;

export interface UserRef { userId: string; displayName?: string; timezone?: string; }

export interface ClientRef { clientId: string; name: string; }

export interface ProjectRef { projectId: string; name: string; client: ClientRef; isActive: boolean; }

export interface TaskRef {
  taskId: string;
  code?: string;
  name: string;
  project: ProjectRef;
  isBillable?: boolean;
  isActive: boolean;
  tags?: string[];
}

export interface TimesheetEntry { taskId: string; date: DateYMD; value: MDValue; }

export type TimesheetStatus = 'draft' | 'submitted';

export interface TimesheetWeek {
  week: WeekId;
  forUser: UserRef;
  status: TimesheetStatus;
  version: string;
  datesInWeek: DateYMD[]; // 7 items, provided by backend
  entries: TimesheetEntry[];
  lastModifiedBy?: UserRef;
  lastModifiedAt?: string; // ISO timestamp
}

export interface Totals {
  perDay: Record<DateYMD, number>;
  perTask: Record<string /*taskId*/, number>;
  weekTotal: number;
}

export interface ValidationIssue {
  kind: 'InvalidValue' | 'DayOverCapacity' | 'DuplicateTask' | 'MissingTask';
  message: string;
  context?: { taskId?: string; date?: DateYMD; value?: number; dayTotal?: number };
}

export interface ValidationReport { isValid: boolean; issues: ValidationIssue[]; }

// Task search (selector)
export interface TaskSearchParams {
  userId: string;
  query?: string;
  projectId?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface TaskSearchResult { items: TaskRef[]; total: number; page: number; pageSize: number; }
```

---

## 🌐 `services/timesheet.service.ts`
```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TimesheetWeek, WeekId } from '../models/timesheet.models';

@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private readonly baseUrl = '/api/timesheets'; // TODO: adjust base URL if needed

  constructor(private http: HttpClient) {}

  loadWeek(userId: string, week: WeekId): Observable<TimesheetWeek> {
    const params = new URLSearchParams({ userId, isoYear: String(week.isoYear), isoWeek: String(week.isoWeek) });
    return this.http.get<TimesheetWeek>(`${this.baseUrl}?${params.toString()}`);
  }

  saveDraft(payload: TimesheetWeek): Observable<{ version: string }> {
    // Server coerces status to 'draft'
    return this.http.put<{ version: string }>(this.baseUrl, payload);
  }

  submit(userId: string, week: WeekId, version: string): Observable<{ status: 'submitted'; version: string }> {
    return this.http.post<{ status: 'submitted'; version: string }>(`${this.baseUrl}/submit`, {
      userId,
      isoYear: week.isoYear,
      isoWeek: week.isoWeek,
      version,
    });
  }

  copyLastWeek(request: {
    userId: string;
    source: WeekId;
    target: WeekId;
    mode: 'structure_only' | 'structure_and_values';
  }): Observable<{ draft: TimesheetWeek }> {
    return this.http.post<{ draft: TimesheetWeek }>(`${this.baseUrl}/copy-last-week`, request);
  }

  applyTemplate(request: { userId: string; week: WeekId; templateId: string }): Observable<{ draft: TimesheetWeek }> {
    return this.http.post<{ draft: TimesheetWeek }>(`${this.baseUrl}/apply-template`, request);
  }
}
```

---

## 🌐 `services/task.service.ts`
```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaskSearchParams, TaskSearchResult } from '../models/timesheet.models';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly baseUrl = '/api/tasks'; // TODO: adjust base URL if needed
  constructor(private http: HttpClient) {}

  search(params: TaskSearchParams): Observable<TaskSearchResult> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    });
    return this.http.get<TaskSearchResult>(`${this.baseUrl}?${qs.toString()}`);
  }
}
```

---

## 🧠 `store/timesheet.store.ts`
```ts
import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, of } from 'rxjs';
import { catchError, concatMap, exhaustMap, map, switchMap, tap } from 'rxjs/operators';
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
  // =============== ctor ===============
  constructor(private api: TimesheetService) {
    super(initialState);
  }

  // =============== selectors ===============
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
    Object.entries(s.totalsPerDay).forEach(([date, total]) => {
      if (total > 1) {
        issues.push({ kind: 'DayOverCapacity', message: `${date} exceeds 1.0 (${total})`, context: { date, dayTotal: total } });
      }
    });
    return { isValid: issues.length === 0, issues };
  });

  // =============== updaters ===============
  readonly setLoading = this.updater<boolean>((state, loading) => ({ ...state, loading }));
  readonly setSaving = this.updater<boolean>((state, saving) => ({ ...state, saving }));
  readonly setDirty = this.updater<boolean>((state, dirty) => ({ ...state, dirty }));
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

  readonly loadFailure = this.updater<{ code: string; message: string }>((s, e) => ({ ...s, loading: false, error: e }));

  readonly addTask = this.updater<TaskRef>((s, task) => {
    if (s.selectedTaskIds.includes(task.taskId)) return s;
    const tasksById = { ...s.tasksById, [task.taskId]: task };
    const selectedTaskIds = [...s.selectedTaskIds, task.taskId];
    const cellByTaskDate = { ...s.cellByTaskDate, [task.taskId]: s.cellByTaskDate[task.taskId] || {} };
    return { ...s, tasksById, selectedTaskIds, cellByTaskDate, dirty: true };
  });

  readonly removeTask = this.updater<string>((s, taskId) => {
    if (!s.selectedTaskIds.includes(taskId)) return s;
    // remove entries for taskId
    const entries = s.entries.filter((e) => e.taskId !== taskId);
    const { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal, selectedTaskIds, tasksById } = buildIndexes(entries);
    return {
      ...s,
      entries,
      cellByTaskDate,
      totalsPerDay,
      totalsPerTask,
      weekTotal,
      selectedTaskIds, // rebuilt
      tasksById,       // rebuilt (keeps tasks present in entries)
      dirty: true,
    };
  });

  readonly clearRow = this.updater<string>((s, taskId) => {
    // remove entries for taskId but keep the row in UI (keep tasksById + selectedTaskIds)
    const entries = s.entries.filter((e) => e.taskId !== taskId);
    const { cellByTaskDate, totalsPerDay, totalsPerTask, weekTotal } = buildIndexes(entries, s.selectedTaskIds, s.tasksById);
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
    if (value === 0) delete cellByTaskDate[taskId][date]; else cellByTaskDate[taskId][date] = value;

    // Ensure row exists in UI
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
        entries = entries.map((e) => {
          if (e.taskId === taskId && e.date === date) { replaced = true; return { ...e, value }; }
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

  // =============== effects ===============
  readonly initEffect = this.effect<{ userId: string; week: WeekId }>((params$) =>
    params$.pipe(
      tap(({ week }) => this.setWeek(week)),
      switchMap(({ userId, week }) => this.loadWeekEffect(of({ userId, week })))
    )
  );

  readonly loadWeekEffect = this.effect<{ userId: string; week: WeekId }>((source$) =>
    source$.pipe(
      tap(() => this.setLoading(true)),
      switchMap(({ userId, week }) =>
        this.api.loadWeek(userId, week).pipe(
          tap((res) => this.loadSuccess(res)),
          catchError((err) => {
            this.loadFailure({ code: 'LOAD_ERROR', message: err?.message || 'Failed to load' });
            return of(null);
          }),
          tap(() => this.setLoading(false))
        )
      )
    )
  );

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
          catchError((err) => {
            this.setError({ code: 'SAVE_ERROR', message: err?.message || 'Failed to save' });
            return of(null);
          }),
          tap(() => this.setSaving(false))
        );
      })
    )
  );

  readonly submitEffect = this.effect<void>((trigger$) =>
    trigger$.pipe(
      concatMap(() => {
        const s = this.get();
        if (!s.contextUser || !s.week) return of(null);
        // Optional: block if invalid
        const anyOver = Object.values(s.totalsPerDay).some((t) => t > 1);
        if (anyOver) return of(null);
        this.setSaving(true);
        return this.api.submit(s.contextUser.userId, s.week, s.version).pipe(
          tap((r) => {
            this.setStatus(r.status);
            this.setVersion(r.version);
            this.setDirty(false);
          }),
          catchError((err) => {
            this.setError({ code: 'SUBMIT_ERROR', message: err?.message || 'Failed to submit' });
            return of(null);
          }),
          tap(() => this.setSaving(false))
        );
      })
    )
  );
}

// -------- helpers ---------
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
```

---

## 🧩 `timesheet-page/timesheet-page.component.ts`
```ts
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { TimesheetStore } from '../store/timesheet.store';
import { TaskRef, UserRef, WeekId } from '../models/timesheet.models';

@Component({
  selector: 'app-timesheet-page',
  templateUrl: './timesheet-page.component.html',
  styleUrls: ['./timesheet-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetPageComponent implements OnInit, OnDestroy {
  vm$ = this.store.vm$;
  validation$ = this.store.validation$;
  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private store: TimesheetStore) {}

  ngOnInit(): void {
    // TODO: Replace with real user context
    const me: UserRef = { userId: 'me', displayName: 'You', timezone: 'Europe/Lisbon' };
    this.store.setContextUser(me);

    this.route.paramMap
      .pipe(
        map((p) => ({ isoYear: Number(p.get('isoYear')), isoWeek: Number(p.get('isoWeek')) } as WeekId)),
        takeUntil(this.destroy$)
      )
      .subscribe((week) => {
        this.store.initEffect({ userId: me.userId, week });
      });
  }

  onWeekChange(week: WeekId) {
    const userId = this.store.get().contextUser?.userId || 'me';
    this.store.initEffect({ userId, week });
  }

  onTaskSelected(task: TaskRef) { this.store.addTask(task); }

  onCellEdit(e: { taskId: string; date: string; value: 0 | 0.25 | 0.5 | 0.75 | 1 }) { this.store.setEntryValue(e); }

  onRowClear(e: { taskId: string }) { this.store.clearRow(e.taskId); }

  onBulkSet(e: { taskId: string; dates: string[]; value: 0 | 0.25 | 0.5 | 0.75 | 1 }) { this.store.bulkSet(e); }

  saveDraft() { this.store.saveDraftEffect(); }

  submit() { this.store.submitEffect(); }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
```

### `timesheet-page/timesheet-page.component.html`
```html
<div class="page">
  <div class="toolbar">
    <app-timesheet-week-nav
      [week]="(vm$ | async)?.week"
      [datesInWeek]="(vm$ | async)?.dates"
      (weekChange)="onWeekChange($event)">
    </app-timesheet-week-nav>

    <span class="spacer"></span>

    <mat-chip color="primary" selected>{{ (vm$ | async)?.status | titlecase }}</mat-chip>

    <button mat-stroked-button (click)="saveDraft()" [disabled]="(vm$ | async)?.saving || !(vm$ | async)?.dirty">
      <mat-icon>save</mat-icon>
      Save Draft
    </button>

    <button mat-raised-button color="primary" (click)="submit()" [disabled]="!(validation$ | async)?.isValid || (vm$ | async)?.saving">
      <mat-icon>check_circle</mat-icon>
      Submit
    </button>
  </div>

  <div class="actions">
    <app-timesheet-task-selector (taskSelected)="onTaskSelected($event)"></app-timesheet-task-selector>
  </div>

  <section class="grid-wrapper" *ngIf="vm$ | async as vm">
    <app-timesheet-grid
      [dates]="vm.dates"
      [rowOrder]="vm.rowOrder"
      [taskById]="vm.taskById"
      [cellByTaskDate]="vm.cellByTaskDate"
      [totals]="vm.totals"
      [status]="vm.status"
      [validation]="(validation$ | async)!"
      (cellEdit)="onCellEdit($event)"
      (rowClear)="onRowClear($event)"
      (bulkSet)="onBulkSet($event)">
    </app-timesheet-grid>
  </section>
</div>
```

### `timesheet-page/timesheet-page.component.scss`
```scss
.page { display: flex; flex-direction: column; gap: 12px; }
.toolbar { display: flex; align-items: center; gap: 12px; }
.spacer { flex: 1; }
.grid-wrapper { border: 1px solid rgba(0,0,0,.08); border-radius: 8px; padding: 8px; }
```

---

## 📅 `components/timesheet-week-nav/timesheet-week-nav.component.ts`
```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { WeekId, DateYMD } from '../../models/timesheet.models';

@Component({
  selector: 'app-timesheet-week-nav',
  templateUrl: './timesheet-week-nav.component.html',
  styleUrls: ['./timesheet-week-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetWeekNavComponent {
  @Input() week: WeekId | null = null;
  @Input() datesInWeek: DateYMD[] = [];
  @Output() weekChange = new EventEmitter<WeekId>();

  prev() {
    if (!this.week) return;
    this.weekChange.emit({ isoYear: this.week.isoYear, isoWeek: this.week.isoWeek - 1 }); // TODO: handle year wrap
  }
  next() {
    if (!this.week) return;
    this.weekChange.emit({ isoYear: this.week.isoYear, isoWeek: this.week.isoWeek + 1 }); // TODO: handle year wrap
  }
  today() {
    const today = new Date();
    // TODO: compute ISO week properly if needed; placeholder: use current year/week=1
    this.weekChange.emit({ isoYear: today.getFullYear(), isoWeek: 1 });
  }
}
```

### `timesheet-week-nav.component.html`
```html
<div class="week-nav">
  <button mat-icon-button (click)="prev()" matTooltip="Previous week">
    <mat-icon>chevron_left</mat-icon>
  </button>

  <div class="label">
    <strong>Week:</strong>
    <span *ngIf="week as w">{{ w.isoYear }} - {{ w.isoWeek }}</span>
    <span class="dates" *ngIf="datesInWeek?.length"> ({{ datesInWeek[0] }} — {{ datesInWeek[6] }})</span>
  </div>

  <button mat-stroked-button (click)="today()">Today</button>
  <button mat-icon-button (click)="next()" matTooltip="Next week">
    <mat-icon>chevron_right</mat-icon>
  </button>
</div>
```

### `timesheet-week-nav.component.scss`
```scss
.week-nav { display: flex; align-items: center; gap: 8px; }
.label { display: flex; align-items: center; gap: 6px; }
.dates { opacity: .7; }
```

---

## 🔎 `components/timesheet-task-selector/timesheet-task-selector.component.ts`
```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { TaskRef } from '../../models/timesheet.models';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-timesheet-task-selector',
  templateUrl: './timesheet-task-selector.component.html',
  styleUrls: ['./timesheet-task-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetTaskSelectorComponent {
  @Output() taskSelected = new EventEmitter<TaskRef>();

  search = new FormControl('');
  results$: Observable<TaskRef[]> = this.search.valueChanges.pipe(
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((q) => (typeof q === 'string' && q.trim().length > 0 ? this.api.search({ userId: 'me', query: q, activeOnly: true }) : of({ items: [], page: 1, pageSize: 20, total: 0 }))),
    switchMap((r) => of(r.items))
  );

  constructor(private api: TaskService) {}

  display(task?: TaskRef): string { return task ? `${task.project?.client?.name ?? ''} / ${task.project?.name ?? ''} • ${task.name}` : ''; }

  choose(task: TaskRef) { if (task) this.taskSelected.emit(task); }
}
```

### `timesheet-task-selector.component.html`
```html
<mat-form-field class="task-field" appearance="outline">
  <mat-label>Add task</mat-label>
  <input matInput [formControl]="search" [matAutocomplete]="auto" placeholder="Search by name/code" />
  <mat-autocomplete #auto="matAutocomplete" [displayWith]="display.bind(this)" (optionSelected)="choose($event.option.value)">
    <mat-option *ngFor="let t of results$ | async" [value]="t">
      <div class="opt">
        <span class="client">{{ t.project.client.name }}</span>
        <span class="sep">/</span>
        <span class="project">{{ t.project.name }}</span>
        <span class="dot">•</span>
        <span class="name">{{ t.name }}</span>
      </div>
    </mat-option>
  </mat-autocomplete>
</mat-form-field>
```

### `timesheet-task-selector.component.scss`
```scss
.task-field { width: 420px; max-width: 100%; }
.opt { display: flex; gap: 6px; align-items: baseline; }
.sep, .dot { opacity: .6; }
.client { font-weight: 600; }
```

---

## 🧮 `components/timesheet-grid/timesheet-grid.component.ts`
```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DateYMD, MDValue, TaskRef, ValidationIssue } from '../../models/timesheet.models';

@Component({
  selector: 'app-timesheet-grid',
  templateUrl: './timesheet-grid.component.html',
  styleUrls: ['./timesheet-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetGridComponent {
  @Input() dates: DateYMD[] = [];
  @Input() rowOrder: string[] = [];
  @Input() taskById: Record<string, TaskRef> = {};
  @Input() cellByTaskDate: Record<string, Record<string, MDValue>> = {};
  @Input() totals: { perDay: Record<string, number>; perTask: Record<string, number>; weekTotal: number } = { perDay: {}, perTask: {}, weekTotal: 0 };
  @Input() status: 'draft' | 'submitted' = 'draft';
  @Input() validation: { isValid: boolean; issues: ValidationIssue[] } = { isValid: true, issues: [] };

  @Output() cellEdit = new EventEmitter<{ taskId: string; date: DateYMD; value: MDValue }>();
  @Output() rowClear = new EventEmitter<{ taskId: string }>();
  @Output() bulkSet = new EventEmitter<{ taskId: string; dates: DateYMD[]; value: MDValue }>();

  allowed: MDValue[] = [0, 0.25, 0.5, 0.75, 1];

  valueOf(taskId: string, date: DateYMD): MDValue { return this.cellByTaskDate[taskId]?.[date] ?? 0; }

  onChange(taskId: string, date: DateYMD, next: any) {
    const v = Number(next) as MDValue;
    if (!this.allowed.includes(v)) return;
    this.cellEdit.emit({ taskId, date, value: v });
  }
}
```

### `timesheet-grid.component.html`
```html
<div class="grid" *ngIf="dates?.length">
  <table mat-table [dataSource]="rowOrder" class="mat-elevation-z1">

    <!-- Task Column (with footer cell in the same column def) -->
    <ng-container matColumnDef="task">
      <th mat-header-cell *matHeaderCellDef class="sticky">Task</th>
      <td mat-cell *matCellDef="let taskId" class="sticky">
        <div class="task-cell">
          <div class="title">{{ taskById[taskId]?.name || taskId }}</div>
          <div class="meta">{{ taskById[taskId]?.project?.client?.name }} / {{ taskById[taskId]?.project?.name }}</div>
        </div>
        <button mat-icon-button color="warn" (click)="rowClear.emit({ taskId })" [disabled]="status==='submitted'" matTooltip="Clear row">
          <mat-icon>clear</mat-icon>
        </button>
      </td>
      <td mat-footer-cell *matFooterCellDef class="sticky">Totals</td>
    </ng-container>

    <!-- Dynamic Day Columns (header, cell, and footer in the same def) -->
    <ng-container *ngFor="let d of dates" [matColumnDef]="d">
      <th mat-header-cell *matHeaderCellDef [class.invalid]="(totals.perDay[d]||0) > 1">{{ d }}</th>
      <td mat-cell *matCellDef="let taskId">
        <mat-select [disabled]="status==='submitted'" [value]="valueOf(taskId, d)" (selectionChange)="onChange(taskId, d, $event.value)" panelClass="md-panel">
          <mat-option *ngFor="let v of allowed" [value]="v">{{ v }}</mat-option>
        </mat-select>
      </td>
      <td mat-footer-cell *matFooterCellDef [class.invalid]="(totals.perDay[d]||0) > 1">{{ totals.perDay[d] || 0 }}</td>
    </ng-container>

    <!-- Row total column -->
    <ng-container matColumnDef="rowTotal">
      <th mat-header-cell *matHeaderCellDef>Total</th>
      <td mat-cell *matCellDef="let taskId">{{ totals.perTask[taskId] || 0 }}</td>
      <td mat-footer-cell *matFooterCellDef>{{ totals.weekTotal }}</td>
    </ng-container>

    <tr mat-header-row *matHeaderRowDef="['task', ...dates, 'rowTotal']"></tr>
    <tr mat-row *matRowDef="let row; columns: ['task', ...dates, 'rowTotal'];"></tr>
    <tr mat-footer-row *matFooterRowDef="['task', ...dates, 'rowTotal']" class="totals"></tr>

  </table>
</div>
```

### `timesheet-grid.component.scss`
```scss
.grid { overflow: auto; }
.sticky { position: sticky; left: 0; background: #fff; z-index: 2; }
.mat-header-cell.invalid, td.invalid { background: rgba(244, 67, 54, 0.08); }
.task-cell { display: inline-flex; flex-direction: column; margin-right: 8px; }
.task-cell .meta { opacity: .7; font-size: 12px; }
.totals td { font-weight: 600; }
.md-panel .mat-option { min-width: 80px; }
```

---

## ✅ Notes
- Fill real user context (auth) in `TimesheetPageComponent`.
- Implement ISO week math in `timesheet-week-nav` (placeholder provided).
- Wire snack bars, dialogs, and copy/template actions when backend endpoints are ready.
- Add module route to app routing: `{ path: 'timesheet', loadChildren: () => import('./modules/timesheet/timesheet.module').then(m => m.TimesheetModule) }`.
- Ensure `HttpClientModule` is imported in the app root module.

---

**Next step:** paste these files, run the app, and we’ll iterate on real API payloads and validations.

