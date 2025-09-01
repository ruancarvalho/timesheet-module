import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TimesheetPageComponent } from './timesheet-page/timesheet-page.component';

// Compute today's ISO week for the default redirect (evaluated once at module load)
const defaultPath = (() => {
  const today = new Date();
  const { isoYear, isoWeek } = isoWeekFromDateUTC(today);
  return `${isoYear}/${isoWeek}`;
})();

const routes: Routes = [
  { path: '', redirectTo: defaultPath, pathMatch: 'full' },
  { path: ':isoYear/:isoWeek', component: TimesheetPageComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TimesheetRoutingModule {}

/** Minimal ISO helpers (UTC) */
function isoWeekFromDateUTC(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // 1..7, Mon=1
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this ISO week
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const daysSinceYearStart = Math.floor((d.getTime() - yearStart.getTime()) / 86400000) + 1;
  const isoWeek = Math.ceil(daysSinceYearStart / 7);
  return { isoYear, isoWeek };
}
