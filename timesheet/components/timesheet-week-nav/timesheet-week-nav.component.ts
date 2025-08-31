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