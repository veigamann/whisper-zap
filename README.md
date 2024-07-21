# whisper-zap

## Overview

This is a quick project I've written for personal use. It transcribes audio messages within WhatsApp chats.

#### ⚠️ Important Note

This project was developed as a rapid prototype in approximately one hour. It lacks proper build configurations, transpilation/compilation to JavaScript, and production-ready database migrations. It's intended as a proof of concept rather than a fully polished application.

## Features

- Audio message transcription using AI
- Whitelist-based (chat-based) access control
- Adjustable transcription temperature settings
- Customizable command prefix

## Technology Stack

- Node.js
- TypeScript
- Prisma (for database management)
- Groq SDK (for AI-powered transcription)
- @whiskeysockets/baileys (for WhatsApp Web API integration)

## Quick Start

1. Clone the repository
2. Install dependencies: `bun install`
3. Configure environment variables in a `.env` file
4. Generate Prisma client: `bunx prisma generate`
5. Apply database migrations: `bunx prisma migrate dev`
6. Manage whitelist: `bun run whitelist`
7. Launch the bot: `bun run start`

## Available Commands

- `.jid`: Retrieve current chat JID
- `.add`: Add current chat JID to whitelist
- `.del`: Remove current chat JID from whitelist
- `.temp [value]`: Set or get temperature (global)
- `.jids`: List whitelisted JIDs
- `.prefix [new_prefix]`: Set or get a new command prefix
- `.help`: Displays the help message

## Whitelist Management

Use the `whitelist.ts` CLI tool to manage JIDs (WhatsApp IDs) that can interact with the bot: (make sure to add your own JID before running `bun run start` so you can actually use the bot yourself)

```bash
bun run whitelist <command> [JID]
```

**Commands:**

- `add <JID>`: Whitelist a JID
- `remove <JID>`: Remove a JID from whitelist
- `list`: Display all whitelisted JIDs

## Configuration

Customize the bot behavior using these environment variables:

- `BOT_PREFIX`: Bot message prefix (default: "> 🤖 _[BOT]_")
- `CMD_PREFIX`: Command prefix (default: ".")
- `WORKING_REACTION`: "Working" status emoji (default: "⚙️")
- `ERROR_REACTION`: "Error" status emoji (default: "❌")
- `DONE_REACTION`: "Done" status emoji (default: "✅")
- `GROQ_API_KEY`: Your Groq API key for transcription

## Contributing

While contributions are welcome, please note that this project is not actively maintained due to its prototype nature.

## Acknowledgements

- Baileys: Reverse engineered whatsapp web API
- Groq: free (at the time of writing) whisper API endpoint
