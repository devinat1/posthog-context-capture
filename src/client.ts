import type { PostHogConfig } from "./config.js";
import type {
  Person,
  PostHogEvent,
  HogQLQueryResult,
  TimeframeOptions,
} from "./types.js";

interface ExecuteQueryOptions {
  query: string;
}

/**
 * Escapes a string value for safe use in HogQL queries.
 * Handles single quotes, backslashes, null bytes, and other special characters.
 */
const escapeHogQLString = ({ value }: { value: string }): string => {
  return value
    .replace(/\\/g, "\\\\")      // Escape backslashes first
    .replace(/'/g, "\\'")         // Escape single quotes
    .replace(/\0/g, "\\0")        // Escape null bytes
    .replace(/\n/g, "\\n")        // Escape newlines
    .replace(/\r/g, "\\r")        // Escape carriage returns
    .replace(/\t/g, "\\t");       // Escape tabs
};

const parseRelativeDate = ({ dateString }: { dateString: string }): Date => {
  const now = new Date();
  const match = dateString.match(/^(\d+)([dhwm])$/);

  if (!match) {
    return new Date(dateString);
  }

  const [, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10);

  switch (unit) {
    case "h":
      return new Date(now.getTime() - amount * 60 * 60 * 1000);
    case "d":
      return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
    case "w":
      return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
    case "m": {
      const result = new Date(now);
      result.setMonth(result.getMonth() - amount);
      return result;
    }
    default:
      return now;
  }
};

const formatDateForHogQL = ({ date }: { date: Date }): string => {
  return date.toISOString().replace("T", " ").replace("Z", "");
};

const buildTimestampClause = ({
  options,
}: {
  options: TimeframeOptions;
}): string => {
  const clauses: string[] = [];

  if (options.from) {
    const fromDate = parseRelativeDate({ dateString: options.from });
    clauses.push(`timestamp >= '${formatDateForHogQL({ date: fromDate })}'`);
  }

  if (options.to) {
    const toDate = parseRelativeDate({ dateString: options.to });
    clauses.push(`timestamp <= '${formatDateForHogQL({ date: toDate })}'`);
  }

  return clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "";
};

export class PostHogClient {
  private readonly config: PostHogConfig;

  constructor({ config }: { config: PostHogConfig }) {
    this.config = config;
  }

  private async executeQuery<T>({
    query,
  }: ExecuteQueryOptions): Promise<HogQLQueryResult<T>> {
    const url = `${this.config.apiBaseUrl}/api/projects/${this.config.projectId}/query/`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.personalApiKey}`,
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PostHog API error (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as HogQLQueryResult<T>;

    if (process.env.DEBUG) {
      console.log("HogQL Response:", JSON.stringify(result, null, 2));
    }

    return result;
  }

  async getPersonByEmail({
    email,
  }: {
    email: string;
  }): Promise<Person | null> {
    const escapedEmail = escapeHogQLString({ value: email });
    const query = `
      SELECT id, properties
      FROM persons
      WHERE properties.email = '${escapedEmail}'
      LIMIT 1
    `;

    const result = await this.executeQuery<[string, string]>({
      query,
    });

    if (result.results.length === 0) {
      return null;
    }

    const [id, propertiesJson] = result.results[0];
    const properties = this.safeParseJson({ json: propertiesJson });
    return { id, distinctIds: [], properties };
  }

  private safeParseJson({ json }: { json: string }): Record<string, unknown> {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  async getPersonsByEvent({
    eventName,
    limit = 10,
    from,
    to,
  }: {
    eventName: string;
    limit?: number | null;
    from?: string | null;
    to?: string | null;
  }): Promise<Person[]> {
    const escapedEventName = escapeHogQLString({ value: eventName });
    const timestampClause = buildTimestampClause({ options: { from, to } });
    const effectiveLimit = limit ?? 10;

    const query = `
      SELECT DISTINCT person.id, person.properties
      FROM events
      WHERE event = '${escapedEventName}'${timestampClause}
      ORDER BY timestamp DESC
      LIMIT ${effectiveLimit}
    `;

    const result = await this.executeQuery<[string, string]>({
      query,
    });

    return result.results.map(([id, propertiesJson]) => ({
      id,
      distinctIds: [],
      properties: this.safeParseJson({ json: propertiesJson }),
    }));
  }

  async getPersonEvents({
    personId,
    limit = 50,
    eventType,
    from,
    to,
  }: {
    personId: string;
    limit?: number | null;
    eventType?: string | null;
    from?: string | null;
    to?: string | null;
  }): Promise<PostHogEvent[]> {
    const escapedPersonId = escapeHogQLString({ value: personId });
    const effectiveFrom = from ?? "30d";
    const timestampClause = buildTimestampClause({ options: { from: effectiveFrom, to } });
    const eventTypeClause = eventType
      ? ` AND event = '${escapeHogQLString({ value: eventType })}'`
      : "";
    const effectiveLimit = limit ?? 50;

    const query = `
      SELECT event, timestamp, properties
      FROM events
      WHERE person_id = '${escapedPersonId}'${eventTypeClause}${timestampClause}
      ORDER BY timestamp DESC
      LIMIT ${effectiveLimit}
    `;

    const result = await this.executeQuery<[string, string, string]>({
      query,
    });

    return result.results.map(([event, timestamp, propertiesJson]) => ({
      event,
      timestamp,
      properties: this.safeParseJson({ json: propertiesJson }),
    }));
  }

  async getPersonWithEvents({
    email,
    eventsLimit = 50,
    eventType,
    from,
    to,
  }: {
    email: string;
    eventsLimit?: number | null;
    eventType?: string | null;
    from?: string | null;
    to?: string | null;
  }): Promise<{ person: Person; events: PostHogEvent[] } | null> {
    const person = await this.getPersonByEmail({ email });

    if (!person) {
      return null;
    }

    const events = await this.getPersonEvents({
      personId: person.id,
      limit: eventsLimit,
      eventType,
      from,
      to,
    });

    return { person, events };
  }
}
