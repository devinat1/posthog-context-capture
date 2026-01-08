import { config as loadDotenv } from "dotenv";

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

const isValidRegion = (region: string): region is PostHogRegion => {
  return region === "us" || region === "eu";
};

export const loadConfig = (): PostHogConfig => {
  loadDotenv();

  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const regionInput = process.env.POSTHOG_REGION ?? "us";

  if (!personalApiKey) {
    throw new Error("POSTHOG_PERSONAL_API_KEY environment variable is required.");
  }

  if (!projectId) {
    throw new Error("POSTHOG_PROJECT_ID environment variable is required.");
  }

  if (!isValidRegion(regionInput)) {
    throw new Error(`POSTHOG_REGION must be "us" or "eu", got: "${regionInput}"`);
  }

  const region: PostHogRegion = regionInput;

  return {
    personalApiKey,
    projectId,
    region,
    apiBaseUrl: getApiBaseUrl({ region }),
  };
};
