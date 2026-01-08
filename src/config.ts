import { config as loadDotenv } from "dotenv";

loadDotenv();

export type PostHogRegion = "us" | "eu";

export interface PostHogConfig {
  personalApiKey: string;
  projectId: string;
  region: PostHogRegion;
  apiBaseUrl: string;
}

const getApiBaseUrl = ({ region }: { region: PostHogRegion }): string => {
  return region === "eu"
    ? "https://eu.posthog.com"
    : "https://us.posthog.com";
};

export const loadConfig = (): PostHogConfig => {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const region = (process.env.POSTHOG_REGION ?? "us") as PostHogRegion;

  if (!personalApiKey) {
    throw new Error("POSTHOG_PERSONAL_API_KEY environment variable is required.");
  }

  if (!projectId) {
    throw new Error("POSTHOG_PROJECT_ID environment variable is required.");
  }

  return {
    personalApiKey,
    projectId,
    region,
    apiBaseUrl: getApiBaseUrl({ region }),
  };
};
