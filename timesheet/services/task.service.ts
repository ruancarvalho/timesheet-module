import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaskSearchParams, TaskSearchResult } from '../models/timesheet.models';


@Injectable({ providedIn: 'root' })
export class TaskService {
    private readonly baseUrl = '/api/tasks'; // TODO: adjust base URL if needed
    constructor(private http: HttpClient) { }

    search(params: TaskSearchParams): Observable<TaskSearchResult> {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null) qs.set(k, String(v));
        });
        return this.http.get<TaskSearchResult>(`${this.baseUrl}?${qs.toString()}`);
    }
}