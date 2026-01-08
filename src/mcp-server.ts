#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { PostHogClient } from "./client.js";

const server = new Server(
  {
    name: "posthog-context-capture",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const config = loadConfig();
const client = new PostHogClient({ config });

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
        const typedArgs = args as {
          email: string;
          eventsLimit?: number;
          eventType?: string;
          from?: string;
          to?: string;
        };

        const result = await client.getPersonWithEvents({
          email: typedArgs.email,
          eventsLimit: typedArgs.eventsLimit ?? 50,
          eventType: typedArgs.eventType,
          from: typedArgs.from,
          to: typedArgs.to,
        });

        if (!result) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { error: `No person found with email: ${typedArgs.email}` },
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
        const typedArgs = args as {
          eventName: string;
          limit?: number;
          from?: string;
          to?: string;
        };

        const persons = await client.getPersonsByEvent({
          eventName: typedArgs.eventName,
          limit: typedArgs.limit ?? 10,
          from: typedArgs.from,
          to: typedArgs.to,
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
        const typedArgs = args as {
          personId: string;
          limit?: number;
          eventType?: string;
          from?: string;
          to?: string;
        };

        const events = await client.getPersonEvents({
          personId: typedArgs.personId,
          limit: typedArgs.limit ?? 50,
          eventType: typedArgs.eventType,
          from: typedArgs.from,
          to: typedArgs.to,
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

const main = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch(console.error);
