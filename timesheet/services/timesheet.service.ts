import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TimesheetWeek, WeekId } from '../models/timesheet.models';

@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private readonly baseUrl = '/api/timesheets'; // TODO: adjust base URL if needed

  constructor(private http: HttpClient) {}

  loadWeek(userId: string, week: WeekId): Observable<TimesheetWeek> {
    const params = new URLSearchParams({
      userId,
      isoYear: String(week.isoYear),
      isoWeek: String(week.isoWeek),
    });
    return this.http.get<TimesheetWeek>(`${this.baseUrl}?${params.toString()}`);
  }

  saveDraft(payload: TimesheetWeek): Observable<{ version: string }> {
    // Server coerces status to 'draft'
    return this.http.put<{ version: string }>(this.baseUrl, payload);
  }

  submit(
    userId: string,
    week: WeekId,
    version: string
  ): Observable<{ status: 'submitted'; version: string }> {
    return this.http.post<{ status: 'submitted'; version: string }>(
      `${this.baseUrl}/submit`,
      { userId, isoYear: week.isoYear, isoWeek: week.isoWeek, version }
    );
  }

  copyLastWeek(request: {
    userId: string;
    source: WeekId;
    target: WeekId;
    mode: 'structure_only' | 'structure_and_values';
  }): Observable<{ draft: TimesheetWeek }> {
    return this.http.post<{ draft: TimesheetWeek }>(
      `${this.baseUrl}/copy-last-week`,
      request
    );
  }

  applyTemplate(request: {
    userId: string;
    week: WeekId;
    templateId: string;
  }): Observable<{ draft: TimesheetWeek }> {
    return this.http.post<{ draft: TimesheetWeek }>(
      `${this.baseUrl}/apply-template`,
      request
    );
  }
}
