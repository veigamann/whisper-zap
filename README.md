# whisper-zap

whisper-zap transcribes audio messages using the `whisper-v3-large` via the [Groq](https://www.groq.com/) API and manages user access through a whitelist system. I've written the basic gist of it myself and used Claude 3.5 Sonnet along with Github Copilot to write the boring parts like CRUD operations and command parsing and handling.

I've written this in an hour or so, so it's not perfect, may be very broken, and lacks a lot of features, but it works for me. Also, UX is not a priority here, so don't expect fancy prompts or logs.

I'm sharing it here in case someone finds it useful or wants to contribute to it. I'm not actively maintaining it, but I'll try to help if you have any questions.

## ⚠️ Disclaimer

This project is just a proof of concept and not intended for production use or deployment without further development and security considerations.

I didn't bother adding JS/TS build steps, I'm just running it under the hood directly with `tsx` (script in `package.json`). Using `bun` purely as a package manager.

## 🚀 Features

- Transcribe audio messages in WhatsApp chats
- User whitelist management
- Admin commands for bot configuration
- Customizable command prefix
- Chat-specific settings for the transcription
- Reaction feedback for message processing status

## 🏁 Quick Start

1. Clone the repository:

   ```
   git clone https://github.com/veigamann/whisper-zap
   cd whisper-zap
   ```

2. Install dependencies:

   ```
   bun install
   ```

3. Set up environment variables in a `.env` file:

   ```
   DATABASE_URL="file:./dev.db"
   GROQ_API_KEY="your_groq_api_key"
   BOT_PREFIX="> 🤖  *[BOT]*"
   WORKING_REACTION="⚙️"
   ERROR_REACTION="❌"
   DONE_REACTION="✅"
   ADMIN_USER_IDS="5511999999999,5511888888888"
   ```

4. Generate Prisma client:

   ```
   bunx prisma generate
   ```

5. Apply database migrations:

   ```
   bunx prisma migrate dev
   ```

6. Manage whitelist (optional):

   ```
   bun run whitelist
   ```

7. Launch the bot:
   ```
   bun run start
   ```

## 📚 Available Commands

- `.help` - Show help message
- `.enable` - Enable the bot for the current chat
- `.disable` - Disable the bot for the current chat
- `.status` - Get bot status
- `.id` - Get current chat and user IDs
- `.temp [value]` - Set or get temperature (Admin only)
- `.lang <rm> [language]` - Set or get the transcription language (Admin only)
- `.prompt <rm> [prompt]` - Set or get the transcription prompt (Admin only)
- `.prefix [newPrefix]` - Set or get command prefix
- `.user <add|rm|list> [userId]` - Manage whitelisted users
- `.admin <add|rm|list> [userId]` - Manage admins (Admin only)

## 🤝 Contributing

As I made this for myself and just for fun, it's not actively maintained. However, if you'd like to contribute or improve the project, feel free to fork the repository and submit pull requests.

## Resources

- [Groq](https://www.groq.com/) for providing the audio transcription API
- [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) for the WhatsApp Web API implementation
- [Prisma](https://www.prisma.io/) for the database ORM
