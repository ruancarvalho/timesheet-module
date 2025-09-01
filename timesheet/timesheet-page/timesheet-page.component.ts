import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
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
  private currentUserId = 'me'; // TODO: replace with real auth user id

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly store: TimesheetStore
  ) {}

  ngOnInit(): void {
    // Seed user context (replace with your auth integration)
    const me: UserRef = { userId: 'me', displayName: 'You', timezone: 'Europe/Lisbon' };
    this.currentUserId = me.userId;
    this.store.setContextUser(me);

    // Load on route changes
    this.route.paramMap
      .pipe(
        map((p) => ({
          isoYear: Number(p.get('isoYear')),
          isoWeek: Number(p.get('isoWeek')),
        }) as WeekId),
        takeUntil(this.destroy$)
      )
      .subscribe((week) => {
        this.store.setWeek(week);
        this.store.loadWeekEffect({ userId: this.currentUserId, week });
      });
  }

  onWeekChange(week: WeekId) {
    // Update URL; the paramMap subscription will trigger the load
    this.router.navigate(['../', week.isoYear, week.isoWeek], { relativeTo: this.route });
  }

  onTaskSelected(task: TaskRef) {
    this.store.addTask(task);
  }

  onCellEdit(e: { taskId: string; date: string; value: 0 | 0.25 | 0.5 | 0.75 | 1 }) {
    this.store.setEntryValue(e);
  }

  onRowClear(e: { taskId: string }) {
    this.store.clearRow(e.taskId);
  }

  onBulkSet(e: { taskId: string; dates: string[]; value: 0 | 0.25 | 0.5 | 0.75 | 1 }) {
    this.store.bulkSet(e);
  }

  saveDraft() {
    this.store.saveDraftEffect();
  }

  submit() {
    this.store.submitEffect();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
