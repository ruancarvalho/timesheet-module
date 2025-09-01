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
  @Input() totals: { perDay: Record<string, number>; perTask: Record<string, number>; weekTotal: number } = {
    perDay: {},
    perTask: {},
    weekTotal: 0,
  };
  @Input() status: 'draft' | 'submitted' = 'draft';
  @Input() validation: { isValid: boolean; issues: ValidationIssue[] } = { isValid: true, issues: [] };

  @Output() cellEdit = new EventEmitter<{ taskId: string; date: DateYMD; value: MDValue }>();
  @Output() rowClear = new EventEmitter<{ taskId: string }>();
  @Output() bulkSet = new EventEmitter<{ taskId: string; dates: DateYMD[]; value: MDValue }>();

  readonly allowed: MDValue[] = [0, 0.25, 0.5, 0.75, 1];

  valueOf(taskId: string, date: DateYMD): MDValue {
    return (this.cellByTaskDate[taskId]?.[date] ?? 0) as MDValue;
  }

  onChange(taskId: string, date: DateYMD, next: any) {
    const v = Number(next) as MDValue;
    if (!this.allowed.includes(v)) return;
    this.cellEdit.emit({ taskId, date, value: v });
  }
}
