import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DateYMD, WeekId } from '../../models/timesheet.models';

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
    const { isoYear, isoWeek } = this.week;
    if (isoWeek > 1) {
      this.weekChange.emit({ isoYear, isoWeek: isoWeek - 1 });
    } else {
      const prevYear = isoYear - 1;
      this.weekChange.emit({ isoYear: prevYear, isoWeek: weeksInIsoYear(prevYear) });
    }
  }

  next() {
    if (!this.week) return;
    const { isoYear, isoWeek } = this.week;
    const max = weeksInIsoYear(isoYear);
    if (isoWeek < max) {
      this.weekChange.emit({ isoYear, isoWeek: isoWeek + 1 });
    } else {
      this.weekChange.emit({ isoYear: isoYear + 1, isoWeek: 1 });
    }
  }

  today() {
    const { isoYear, isoWeek } = isoWeekFromDateUTC(new Date());
    this.weekChange.emit({ isoYear, isoWeek });
  }
}

/** ---- ISO helpers (UTC-based to avoid TZ drift) ---- */

/** Returns ISO week + ISO year for a given JS Date (uses UTC). */
function isoWeekFromDateUTC(date: Date): WeekId {
  // Copy at midnight UTC
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Shift to nearest Thursday: ISO week starts Monday, week belongs to the year with that Thursday
  const day = d.getUTCDay() || 7; // 1..7, Mon=1
  d.setUTCDate(d.getUTCDate() + 4 - day); // now 'd' is the Thursday of this ISO week

  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const daysSinceYearStart = Math.floor((d.getTime() - yearStart.getTime()) / 86400000) + 1;

  const isoWeek = Math.ceil(daysSinceYearStart / 7);
  return { isoYear, isoWeek };
}

/** Number of ISO weeks in a given ISO year (52 or 53). */
function weeksInIsoYear(isoYear: number): number {
  // The ISO week number of Dec 28 determines the number of weeks in the year
  const dec28 = new Date(Date.UTC(isoYear, 11, 28));
  return isoWeekFromDateUTC(dec28).isoWeek;
}
