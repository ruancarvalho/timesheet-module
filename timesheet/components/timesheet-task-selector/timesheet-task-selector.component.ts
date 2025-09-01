import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
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

  // TODO: replace 'me' with the real user id from your auth context (or pass as @Input if preferred)
  private readonly userId = 'me';

  search = new FormControl('');
  results$: Observable<TaskRef[]> = this.search.valueChanges.pipe(
    startWith(''),
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((q) =>
      this.api
        .search({
          userId: this.userId,
          query: typeof q === 'string' ? q : '',
          activeOnly: true,
          page: 1,
          pageSize: 20,
        })
        .pipe(
          map((r) => r.items),
          catchError(() => of([]))
        )
    )
  );

  constructor(private api: TaskService) {}

  display(task?: TaskRef): string {
    if (!task) return '';
    const client = task.project?.client?.name ?? '';
    const project = task.project?.name ?? '';
    const code = task.code ? ` [${task.code}]` : '';
    return `${client} / ${project} • ${task.name}${code}`;
  }

  choose(task: TaskRef) {
    if (task) this.taskSelected.emit(task);
  }
}
