import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  TaskRef,
  TaskSearchParams,
  TaskSearchResult,
} from '../models/timesheet.models';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly baseUrl = '/api/tasks'; // TODO: adjust base URL if needed
  constructor(private http: HttpClient) {}

  search(params: TaskSearchParams): Observable<TaskSearchResult> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    });

    return this.http
      .get<TaskSearchResult>(`${this.baseUrl}?${qs.toString()}`)
      .pipe(
        // DEV MOCK: if API not ready, return a small local list filtered by query
        catchError(() => of(generateMockTaskSearchResult(params)))
      );
  }
}

/* ------------ DEV MOCKS (service-local) ------------ */

function generateMockTaskSearchResult(
  params: TaskSearchParams
): TaskSearchResult {
  const all: TaskRef[] = [
    {
      taskId: 'T-101',
      code: 'DEV-101',
      name: 'Implement Feature A',
      isBillable: true,
      isActive: true,
      project: {
        projectId: 'P1',
        name: 'Web App',
        isActive: true,
        client: { clientId: 'C1', name: 'ACME Corp' },
      },
      tags: ['frontend', 'angular'],
    },
    {
      taskId: 'T-202',
      code: 'BUG-202',
      name: 'Fix Bug B',
      isBillable: false,
      isActive: true,
      project: {
        projectId: 'P2',
        name: 'Mobile API',
        isActive: true,
        client: { clientId: 'C2', name: 'Globex' },
      },
      tags: ['maintenance'],
    },
  ];

  const q = (params.query || '').toLowerCase();
  const items = q
    ? all.filter((t) =>
        [t.name, t.code, t.project.name, t.project.client.name].some((s) =>
          (s || '').toLowerCase().includes(q)
        )
      )
    : all;

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? items.length;
  return {
    items: items.slice(0, pageSize),
    total: items.length,
    page,
    pageSize,
  };
}
