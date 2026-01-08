# PostHog Context Capture

CLI and MCP server to look up PostHog persons and their events for debugging.

## Installation

```bash
npm install -g posthog-context-capture
```

## Setup

Set environment variables:

```bash
export POSTHOG_PERSONAL_API_KEY=phx_...
export POSTHOG_PROJECT_ID=12345
export POSTHOG_REGION=us  # or "eu"
```

### Getting Your Credentials

**Personal API Key:**
1. Go to **Settings → Personal API keys** in PostHog
2. Click **"+ Create a personal API Key"**
3. Select the **`query:read`** scope
4. Copy the key (starts with `phx_`)

**Project ID:** Found in your PostHog URL: `https://us.posthog.com/project/12345/...`

## CLI Usage

```bash
# Look up person by email
posthog-lookup --email user@example.com

# With recent events (defaults to last 30 days)
posthog-lookup --email user@example.com --events 100

# Filter by timeframe
posthog-lookup --email user@example.com --from 7d
posthog-lookup --email user@example.com --from 2024-01-01 --to 2024-01-31

# Filter by event type
posthog-lookup --email user@example.com --event-type pageview

# Find persons by event
posthog-lookup --event checkout_failed --limit 10
posthog-lookup --event subscription_cancelled --from 7d --show-properties
```

## MCP Server (for Claude)

Add to your Claude config (`~/.claude.json` or Claude Desktop config):

```json
{
  "mcpServers": {
    "posthog": {
      "type": "stdio",
      "command": "posthog-mcp",
      "env": {
        "POSTHOG_PERSONAL_API_KEY": "phx_...",
        "POSTHOG_PROJECT_ID": "12345",
        "POSTHOG_REGION": "us"
      }
    }
  }
}
```

### Available MCP Tools

- **`lookup_person_by_email`** - Find a person by email with their recent events
- **`lookup_persons_by_event`** - Find persons who triggered a specific event
- **`get_person_events`** - Get events for a specific person ID

## License

MIT
