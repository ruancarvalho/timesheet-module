// Core types for the feature (FE-only shapes)
export type DateYMD = string; // 'YYYY-MM-DD'
export interface WeekId { isoYear: number; isoWeek: number; }
export type MDValue = 0 | 0.25 | 0.5 | 0.75 | 1;
export interface UserRef { userId: string; displayName?: string; timezone?: string; }
export interface ClientRef { clientId: string; name: string; }
export interface ProjectRef { projectId: string; name: string; client: ClientRef; isActive: boolean; }

export interface TaskRef {
    taskId: string;
    code?: string;
    name: string;
    project: ProjectRef;
    isBillable?: boolean;
    isActive: boolean;
    tags?: string[];
}

export interface TimesheetEntry { taskId: string; date: DateYMD; value: MDValue; }

export type TimesheetStatus = 'draft' | 'submitted';

export interface TimesheetWeek {
    week: WeekId;
    forUser: UserRef;
    status: TimesheetStatus;
    version: string;
    datesInWeek: DateYMD[]; // 7 items, provided by backend
    entries: TimesheetEntry[];
    lastModifiedBy?: UserRef;
    lastModifiedAt?: string; // ISO timestamp
}

export interface Totals {
    perDay: Record<DateYMD, number>;
    perTask: Record<string /*taskId*/, number>;
    weekTotal: number;
}

export interface ValidationIssue {
    kind: 'InvalidValue' | 'DayOverCapacity' | 'DuplicateTask' | 'MissingTask';
    message: string;
    context?: { taskId?: string; date?: DateYMD; value?: number; dayTotal?: number };
}

export interface ValidationReport { isValid: boolean; issues: ValidationIssue[]; }

// Task search (selector)
export interface TaskSearchParams {
    userId: string;
    query?: string;
    projectId?: string;
    activeOnly?: boolean;
    page?: number;
    pageSize?: number;
}

export interface TaskSearchResult { items: TaskRef[]; total: number; page: number; pageSize: number; }