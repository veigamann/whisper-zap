# 🤖 WhisperZap

## 🌟 Overview

This is a quick project I've written for personal use. It transcribes audio messages within WhatsApp chats.

## ⚠️ Important Note

This project was developed as a rapid prototype in approximately one hour. It lacks proper build configurations, transpilation/compilation to JavaScript, and production-ready database migrations. It's intended as a proof of concept rather than a fully polished application.

## 🚀 Features

- 🎙️ AI-powered audio message transcription
- 🔒 Whitelist-based access control for chats and users
- 🌡️ Adjustable per-chat transcription temperature settings
- 🛠️ Customizable command prefix
- 👑 Advanced admin controls

## 🏁 Quick Start

1. Clone the repository
2. Install dependencies: `bun install`
3. Set up environment variables in a `.env` file
4. Generate Prisma client: `bunx prisma generate`
5. Apply database migrations: `bunx prisma migrate dev`
6. Manage whitelist: `bun run whitelist`
7. Launch the bot: `bun run start`

## 🛠️ Available Commands

- `.jid`: Get current chat JID(s)
- `.add [jid]`: Add JID to whitelist
- `.del [jid]`: Remove JID from whitelist
- `.temp [value]`: Set or get temperature (Admin only)
- `.jids`: List all whitelisted JIDs
- `.prefix [new_prefix]`: Set or get command prefix
- `.help`: Show help message
- `.admin add|del|list [jid]`: Manage admins (Admin only)

## 🔐 Whitelist Management

Use the `whitelist.ts` CLI tool to manage JIDs (WhatsApp IDs) that can interact with the bot:

```bash
bun run whitelist <command> [JID]
```

**Commands:**

- `add <JID>`: Whitelist a JID
- `remove <JID>`: Remove a JID from whitelist
- `list`: Display all whitelisted JIDs

## ⚙️ Configuration

Customize the bot behavior using these environment variables:

- `BOT_PREFIX`: Bot message prefix (default: "> 🤖 _[BOT]_")
- `CMD_PREFIX`: Command prefix (default: ".")
- `WORKING_REACTION`: "Working" status emoji (default: "⚙️")
- `ERROR_REACTION`: "Error" status emoji (default: "❌")
- `DONE_REACTION`: "Done" status emoji (default: "✅")
- `GROQ_API_KEY`: Your Groq API key for transcription
- `ADMIN_JIDS`: Comma-separated list of admin JIDs

## 🤝 Contributing

While contributions are welcome, please note that this project is not actively maintained due to its prototype nature.

## 🙏 Acknowledgements

- [Baileys](https://github.com/WhiskeySockets/Baileys): Reverse engineered WhatsApp Web API
- [Groq](https://groq.com): Whisper API endpoint (free at the time of writing)
