# WhatsApp Calendar Assistant

A personal WhatsApp bot that manages your Google Calendar through natural language. Text it "Meeting with Shivay tomorrow at 2pm" and it creates the event, checks for conflicts, adds a Google Meet link, and replies like a friend.

## Features

- **Natural language** — create, update, delete, and list calendar events by texting
- **Conflict detection** — warns you about overlapping events, ask to force if needed
- **Google Meet** — auto-generates Meet links for every event
- **Daily summary** — sends your schedule each morning (configurable cron)
- **Reminders** — notifies you 15 minutes before events
- **Self-service OAuth** — new users text the bot and get a Google sign-in link
- **Conversation context** — remembers recent messages so "same time" and "cancel that" just work

## Architecture

Hexagonal / Ports & Adapters — core logic depends only on interfaces, never on concrete implementations.

```
Adapters → Ports (interfaces) → Core (pure domain logic)
```

- `src/core/` — types, config, engine, scheduler, domain errors
- `src/ports/` — 6 port interfaces (messaging, calendar, AI, notification, HTTP, logger)
- `src/handlers/` — intent handler plugins (create, update, delete, list, summary, unknown)
- `src/adapters/` — concrete implementations (WhatsApp, Google Calendar, Groq, Hono, etc.)
- `src/container.ts` — composition root (only file that imports adapters)

Swapping any provider = change 1 env var + create 1 adapter file.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **HTTP:** [Hono](https://hono.dev)
- **AI:** [Groq](https://groq.com) (llama-3.3-70b, raw fetch)
- **Messaging:** WhatsApp Cloud API (raw fetch)
- **Calendar:** Google Calendar API (googleapis)
- **Cron:** [croner](https://github.com/hexagon/croner)
- **Validation:** [Zod](https://zod.dev)

## Setup

### Prerequisites

- [Bun](https://bun.sh) installed
- WhatsApp Business API access ([Meta for Developers](https://developers.facebook.com))
- Google Cloud project with Calendar API enabled
- Groq API key

### Install

```bash
bun install
```

### Configure

```bash
cp .env.example .env
# Fill in your API keys and credentials
```

### Google OAuth (first-time user setup)

Option A — Users self-register by texting the bot. It sends a Google sign-in link automatically.

Option B — Manual setup:
```bash
bun run scripts/auth-setup.ts
```
Follow the prompts to get a refresh token, then add it to the `USERS` env var.

### Run

```bash
# Development (with watch mode)
bun run dev

# Production
bun run start
```

### Other Commands

```bash
bun run typecheck    # Type check without emitting
bun test             # Run tests
```

## Deployment

Configured for [Fly.io](https://fly.io) (Mumbai region) with persistent storage for user data.

```bash
fly deploy
```

## How It Works

1. WhatsApp message hits `POST /webhook`
2. Engine deduplicates and looks up the user
3. Groq parses the message into a structured intent (CREATE_EVENT, UPDATE_EVENT, etc.)
4. The matching handler executes calendar operations
5. Groq generates a natural response from the structured result
6. Bot replies via WhatsApp

## License

MIT
