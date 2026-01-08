export interface Person {
  id: string;
  distinctIds: string[];
  properties: Record<string, unknown>;
}

export interface PostHogEvent {
  event: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

export interface HogQLQueryResult<T = unknown[]> {
  columns: string[];
  types: string[];
  results: T[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface TimeframeOptions {
  from?: string | null;
  to?: string | null;
}

export interface PersonWithEvents {
  person: Person;
  events: PostHogEvent[];
}
