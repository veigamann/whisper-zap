# 🤖 WhatsApp Audio Bot

Welcome to the WhatsApp Audio Bot project! This cool bot transcribes audio messages and responds to commands in your WhatsApp chats. It's like having a personal assistant right in your pocket! 📱✨

## 🌟 Features

- 🎙️ Transcribe audio messages using advanced AI
- 🔐 Whitelist system for controlled access
- 🌡️ Adjustable temperature settings for transcription
- 📝 Customizable command prefix
- 🚀 Easy to set up and use

## 🛠️ Tech Stack

- [Node.js](https://nodejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Prisma](https://www.prisma.io/) for database management
- [Groq SDK](https://www.npmjs.com/package/groq-sdk) for AI-powered transcription
- [@whiskeysockets/baileys](https://www.npmjs.com/package/@whiskeysockets/baileys) for WhatsApp Web API

## 🚀 Getting Started

1. Clone this repository
2. Install dependencies: `npm install`
3. Set up your environment variables in a `.env` file
4. Run the bot: `npm start`

## 📚 Available Commands

- `.jid` - Get the current JID
- `.add` - Add current JID to whitelist
- `.del` - Remove current JID from whitelist
- `.temp [value]` - Set or get temperature
- `.jids` - List all whitelisted JIDs
- `.prefix [new_prefix]` - Set or get command prefix
- `.help` - Show help message

## 🔒 Whitelist Management

The `whitelist.ts` CLI tool allows you to manage the whitelist of JIDs (WhatsApp IDs) that can interact with the bot. Here's how to use it:

```bash
bun run whitelist <command> [JID]
```

### Commands:

- `add <JID>`: Add a JID to the whitelist
- `remove <JID>`: Remove a JID from the whitelist
- `list`: Display all whitelisted JIDs

### Examples:

```bash
# Add a JID to the whitelist
bun run whitelist add 1234567890@s.whatsapp.net

# Remove a JID from the whitelist
bun run whitelist remove 1234567890@s.whatsapp.net

# List all whitelisted JIDs
bun run whitelist list
```

## 🔧 Configuration

Customize your bot by setting these environment variables:

- `BOT_PREFIX`: Prefix for bot messages (default: "> 🤖 _[BOT]_")
- `CMD_PREFIX`: Prefix for commands (default: ".")
- `WORKING_REACTION`: Emoji for "working" status (default: "⚙️")
- `ERROR_REACTION`: Emoji for "error" status (default: "❌")
- `DONE_REACTION`: Emoji for "done" status (default: "✅")
- `GROQ_API_KEY`: Your Groq API key for transcription

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgements

- Thanks to the creators of Baileys for the amazing WhatsApp Web API
- Shoutout to Groq for their powerful AI transcription capabilities

Happy chatting with your new WhatsApp Audio Bot! 🎉🤖
