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