import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TimesheetPageComponent } from './timesheet-page/timesheet-page.component';


// NOTE: Using two params for week to avoid complex parsing in Angular 13 routing.
const routes: Routes = [
    { path: '', redirectTo: (new Date()).getFullYear() + '/' + 1, pathMatch: 'full' },
    { path: ':isoYear/:isoWeek', component: TimesheetPageComponent },
];


@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class TimesheetRoutingModule { }