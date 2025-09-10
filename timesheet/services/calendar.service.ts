import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DayMetaMap, WeekId } from '../models/timesheet.models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly baseUrl = '/api/calendar'; // TODO: adjust to your endpoint

  constructor(private http: HttpClient) {}

  /** Map of YYYY-MM-DD -> { isWeekend, isHoliday, holidayName? } for a given week. */
  getWeekMeta(userId: string, week: WeekId): Observable<DayMetaMap> {
    const params = new URLSearchParams({
      userId,
      isoYear: String(week.isoYear),
      isoWeek: String(week.isoWeek),
    });
    return this.http.get<DayMetaMap>(`${this.baseUrl}/week-meta?${params.toString()}`);
  }
}
