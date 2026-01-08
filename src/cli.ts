import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { PostHogClient } from "./client.js";
import type { Person, PostHogEvent } from "./types.js";

interface CliOptions {
  email?: string;
  event?: string;
  events?: string;
  eventType?: string;
  from?: string;
  to?: string;
  limit?: string;
  properties?: string;
  showProperties?: boolean;
}

const formatPersonProperties = ({
  properties,
  filterKeys,
}: {
  properties: Record<string, unknown>;
  filterKeys?: string[] | null;
}): string => {
  const keysToShow = filterKeys ?? Object.keys(properties);
  const lines = keysToShow
    .filter((key) => key in properties)
    .map((key) => `  ${chalk.gray(key)}: ${chalk.white(JSON.stringify(properties[key]))}`);

  return lines.join("\n");
};

const formatEvent = ({ event }: { event: PostHogEvent }): string => {
  const timestamp = chalk.gray(event.timestamp);
  const eventName = chalk.cyan(event.event);
  const propsPreview = Object.keys(event.properties)
    .slice(0, 3)
    .map((key) => `${key}=${JSON.stringify(event.properties[key])}`)
    .join(", ");

  return `  ${timestamp} ${eventName} ${chalk.gray(propsPreview)}`;
};

const displayPerson = ({
  person,
  filterProperties,
}: {
  person: Person;
  filterProperties?: string[] | null;
}): void => {
  console.log(chalk.bold.green("\nPerson Found:"));
  console.log(`${chalk.gray("ID:")} ${person.id}`);
  console.log(`${chalk.gray("Distinct IDs:")} ${person.distinctIds.join(", ") || "N/A"}`);
  console.log(chalk.gray("\nProperties:"));
  console.log(formatPersonProperties({ properties: person.properties, filterKeys: filterProperties }));
};

const displayEvents = ({ events }: { events: PostHogEvent[] }): void => {
  if (events.length === 0) {
    console.log(chalk.yellow("\nNo events found."));
    return;
  }

  console.log(chalk.bold.blue(`\nEvents (${events.length}):`));
  events.forEach((event) => {
    console.log(formatEvent({ event }));
  });
};

const displayPersonsList = ({
  persons,
  showProperties,
}: {
  persons: Person[];
  showProperties: boolean;
}): void => {
  if (persons.length === 0) {
    console.log(chalk.yellow("\nNo persons found for this event."));
    return;
  }

  console.log(chalk.bold.green(`\nPersons (${persons.length}):`));
  persons.forEach((person, index) => {
    const email = person.properties.email as string | undefined;
    const displayName = email ?? person.id;
    console.log(`${chalk.gray(`${index + 1}.`)} ${chalk.white(displayName)}`);

    if (showProperties) {
      console.log(formatPersonProperties({ properties: person.properties, filterKeys: null }));
      console.log("");
    }
  });
};

export const createCli = (): Command => {
  const program = new Command();

  program
    .name("posthog-lookup")
    .description("Look up PostHog persons and their events")
    .version("1.0.0")
    .option("-e, --email <email>", "Look up person by email")
    .option("--event <eventName>", "Find persons who triggered this event")
    .option("--events <count>", "Number of events to fetch", "50")
    .option("--event-type <type>", "Filter events by type")
    .option("--from <date>", "Start date (e.g., 2024-01-01 or 7d). Defaults to 30d for events.")
    .option("--to <date>", "End date (e.g., 2024-01-31)")
    .option("--limit <count>", "Limit number of persons when searching by event", "10")
    .option("--properties <keys>", "Comma-separated list of properties to show")
    .option("--show-properties", "Show full properties for each person")
    .action(async (options: CliOptions) => {
      try {
        const config = loadConfig();
        const client = new PostHogClient({ config });

        const filterProperties = options.properties
          ? options.properties.split(",").map((p) => p.trim())
          : null;

        if (options.email) {
          const timeRange = options.from ?? "30d";
          console.log(chalk.gray(`Looking up person with email: ${options.email} (events from ${timeRange})...`));

          const result = await client.getPersonWithEvents({
            email: options.email,
            eventsLimit: options.events ? parseInt(options.events, 10) : 50,
            eventType: options.eventType,
            from: options.from,
            to: options.to,
          });

          if (!result) {
            console.log(chalk.red(`No person found with email: ${options.email}`));
            process.exit(1);
          }

          displayPerson({ person: result.person, filterProperties });
          displayEvents({ events: result.events });
        } else if (options.event) {
          const persons = await client.getPersonsByEvent({
            eventName: options.event,
            limit: options.limit ? parseInt(options.limit, 10) : 10,
            from: options.from,
            to: options.to,
          });

          displayPersonsList({
            persons,
            showProperties: options.showProperties ?? false,
          });
        } else {
          console.log(chalk.yellow("Please provide --email or --event to search."));
          program.help();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  return program;
};
