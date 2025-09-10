import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  TaskRef,
  TimesheetEntry,
  TimesheetStatus,
  TimesheetWeek,
  WeekId,
  WeekNavItem,
} from '../models/timesheet.models';

@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private readonly baseUrl = '/api/timesheets'; // TODO: adjust base URL if needed

  constructor(private http: HttpClient) {}

  /** FRAME ONLY: basic metadata for the week (no entries). */
  loadWeekFrame(userId: string, week: WeekId): Observable<Pick<TimesheetWeek, 'forUser' | 'status' | 'version' | 'datesInWeek'>> {
    const params = new URLSearchParams({
      userId,
      isoYear: String(week.isoYear),
      isoWeek: String(week.isoWeek),
    });
    return this.http.get<Pick<TimesheetWeek, 'forUser' | 'status' | 'version' | 'datesInWeek'>>(
      `${this.baseUrl}/frame?${params.toString()}`
    );
  }

  /** Predefined tasks available to the user for the given week. */
  loadTasksForWeek(userId: string, week: WeekId): Observable<TaskRef[]> {
    const params = new URLSearchParams({
      userId,
      isoYear: String(week.isoYear),
      isoWeek: String(week.isoWeek),
    });
    return this.http.get<TaskRef[]>(`${this.baseUrl}/tasks?${params.toString()}`);
  }

  /** Timesheet cell entries for the week (flat array). */
  loadEntriesForWeek(userId: string, week: WeekId): Observable<TimesheetEntry[]> {
    const params = new URLSearchParams({
      userId,
      isoYear: String(week.isoYear),
      isoWeek: String(week.isoWeek),
    });
    return this.http.get<TimesheetEntry[]>(`${this.baseUrl}/entries?${params.toString()}`);
  }

  /** 4-item week-nav: prev, current, next1, next2 (with status and optional dates). */
  getAdjacentWeeks(userId: string, week: WeekId): Observable<WeekNavItem[]> {
    const params = new URLSearchParams({
      userId,
      isoYear: String(week.isoYear),
      isoWeek: String(week.isoWeek),
    });
    return this.http.get<WeekNavItem[]>(`${this.baseUrl}/week-nav?${params.toString()}`);
  }

  /** Legacy full load (kept for completeness) */
  loadWeek(userId: string, week: WeekId): Observable<TimesheetWeek> {
    const params = new URLSearchParams({
      userId,
      isoYear: String(week.isoYear),
      isoWeek: String(week.isoWeek),
    });
    return this.http.get<TimesheetWeek>(`${this.baseUrl}?${params.toString()}`);
  }

  saveDraft(payload: TimesheetWeek): Observable<{ version: string }> {
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
  }) {
    return this.http.post<{ draft: TimesheetWeek }>(`${this.baseUrl}/copy-last-week`, request);
  }

  applyTemplate(request: { userId: string; week: WeekId; templateId: string }) {
    return this.http.post<{ draft: TimesheetWeek }>(`${this.baseUrl}/apply-template`, request);
  }
}
