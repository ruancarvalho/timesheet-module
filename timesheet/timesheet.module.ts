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
import { MatFormFieldModule } from '@angular/material/form-field';
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
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatDividerModule,
  ],
})
export class TimesheetModule {}
