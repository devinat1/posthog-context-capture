#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { PostHogClient } from "./client.js";

interface LookupByEmailArgs {
  email?: unknown;
  eventsLimit?: unknown;
  eventType?: unknown;
  from?: unknown;
  to?: unknown;
}

interface LookupByEventArgs {
  eventName?: unknown;
  limit?: unknown;
  from?: unknown;
  to?: unknown;
}

interface GetPersonEventsArgs {
  personId?: unknown;
  limit?: unknown;
  eventType?: unknown;
  from?: unknown;
  to?: unknown;
}

const isString = (value: unknown): value is string => typeof value === "string";
const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";
const isOptionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || typeof value === "number";

const validateLookupByEmailArgs = ({
  args,
}: {
  args: unknown;
}): { email: string; eventsLimit?: number; eventType?: string; from?: string; to?: string } => {
  const typedArgs = args as LookupByEmailArgs;
  if (!isString(typedArgs.email)) {
    throw new Error("email is required and must be a string");
  }
  if (!isOptionalNumber(typedArgs.eventsLimit)) {
    throw new Error("eventsLimit must be a number");
  }
  if (!isOptionalString(typedArgs.eventType)) {
    throw new Error("eventType must be a string");
  }
  if (!isOptionalString(typedArgs.from)) {
    throw new Error("from must be a string");
  }
  if (!isOptionalString(typedArgs.to)) {
    throw new Error("to must be a string");
  }
  return {
    email: typedArgs.email,
    eventsLimit: typedArgs.eventsLimit,
    eventType: typedArgs.eventType,
    from: typedArgs.from,
    to: typedArgs.to,
  };
};

const validateLookupByEventArgs = ({
  args,
}: {
  args: unknown;
}): { eventName: string; limit?: number; from?: string; to?: string } => {
  const typedArgs = args as LookupByEventArgs;
  if (!isString(typedArgs.eventName)) {
    throw new Error("eventName is required and must be a string");
  }
  if (!isOptionalNumber(typedArgs.limit)) {
    throw new Error("limit must be a number");
  }
  if (!isOptionalString(typedArgs.from)) {
    throw new Error("from must be a string");
  }
  if (!isOptionalString(typedArgs.to)) {
    throw new Error("to must be a string");
  }
  return {
    eventName: typedArgs.eventName,
    limit: typedArgs.limit,
    from: typedArgs.from,
    to: typedArgs.to,
  };
};

const validateGetPersonEventsArgs = ({
  args,
}: {
  args: unknown;
}): { personId: string; limit?: number; eventType?: string; from?: string; to?: string } => {
  const typedArgs = args as GetPersonEventsArgs;
  if (!isString(typedArgs.personId)) {
    throw new Error("personId is required and must be a string");
  }
  if (!isOptionalNumber(typedArgs.limit)) {
    throw new Error("limit must be a number");
  }
  if (!isOptionalString(typedArgs.eventType)) {
    throw new Error("eventType must be a string");
  }
  if (!isOptionalString(typedArgs.from)) {
    throw new Error("from must be a string");
  }
  if (!isOptionalString(typedArgs.to)) {
    throw new Error("to must be a string");
  }
  return {
    personId: typedArgs.personId,
    limit: typedArgs.limit,
    eventType: typedArgs.eventType,
    from: typedArgs.from,
    to: typedArgs.to,
  };
};

const createServer = ({ client }: { client: PostHogClient }): Server => {
  const server = new Server(
    {
      name: "posthog-context-capture",
      version: "1.0.1",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "lookup_person_by_email",
          description:
            "Look up a PostHog person by their email address and retrieve their recent events. Use this to debug issues for a specific user.",
          inputSchema: {
            type: "object" as const,
            properties: {
              email: {
                type: "string",
                description: "The email address of the person to look up.",
              },
              eventsLimit: {
                type: "number",
                description: "Maximum number of events to retrieve. Default: 50.",
              },
              eventType: {
                type: "string",
                description: "Filter events to only this event type.",
              },
              from: {
                type: "string",
                description:
                  "Start date for events. Supports ISO dates (2024-01-01) or relative (7d, 24h, 1w).",
              },
              to: {
                type: "string",
                description: "End date for events. Supports ISO dates or relative formats.",
              },
            },
            required: ["email"],
          },
        },
        {
          name: "lookup_persons_by_event",
          description:
            "Find PostHog persons who triggered a specific event. Use this to find users who experienced a particular action or error.",
          inputSchema: {
            type: "object" as const,
            properties: {
              eventName: {
                type: "string",
                description: "The name of the event to search for.",
              },
              limit: {
                type: "number",
                description: "Maximum number of persons to return. Default: 10.",
              },
              from: {
                type: "string",
                description:
                  "Start date. Supports ISO dates (2024-01-01) or relative (7d, 24h, 1w).",
              },
              to: {
                type: "string",
                description: "End date. Supports ISO dates or relative formats.",
              },
            },
            required: ["eventName"],
          },
        },
        {
          name: "get_person_events",
          description:
            "Get events for a specific person by their person ID. Use this after looking up a person to get more events or different filters.",
          inputSchema: {
            type: "object" as const,
            properties: {
              personId: {
                type: "string",
                description: "The person ID (from lookup_person_by_email result).",
              },
              limit: {
                type: "number",
                description: "Maximum number of events to retrieve. Default: 50.",
              },
              eventType: {
                type: "string",
                description: "Filter events to only this event type.",
              },
              from: {
                type: "string",
                description:
                  "Start date. Supports ISO dates (2024-01-01) or relative (7d, 24h, 1w).",
              },
              to: {
                type: "string",
                description: "End date. Supports ISO dates or relative formats.",
              },
            },
            required: ["personId"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "lookup_person_by_email": {
          const validatedArgs = validateLookupByEmailArgs({ args });

          const result = await client.getPersonWithEvents({
            email: validatedArgs.email,
            eventsLimit: validatedArgs.eventsLimit ?? 50,
            eventType: validatedArgs.eventType,
            from: validatedArgs.from,
            to: validatedArgs.to,
          });

          if (!result) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    { error: `No person found with email: ${validatedArgs.email}` },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "lookup_persons_by_event": {
          const validatedArgs = validateLookupByEventArgs({ args });

          const persons = await client.getPersonsByEvent({
            eventName: validatedArgs.eventName,
            limit: validatedArgs.limit ?? 10,
            from: validatedArgs.from,
            to: validatedArgs.to,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ persons, count: persons.length }, null, 2),
              },
            ],
          };
        }

        case "get_person_events": {
          const validatedArgs = validateGetPersonEventsArgs({ args });

          const events = await client.getPersonEvents({
            personId: validatedArgs.personId,
            limit: validatedArgs.limit ?? 50,
            eventType: validatedArgs.eventType,
            from: validatedArgs.from,
            to: validatedArgs.to,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ events, count: events.length }, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
};

const main = async (): Promise<void> => {
  const config = loadConfig();
  const client = new PostHogClient({ config });
  const server = createServer({ client });

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
