import Groq from "groq-sdk";
import {
  makeWASocket,
  downloadMediaMessage,
  DisconnectReason,
  useMultiFileAuthState,
  type proto,
} from "@whiskeysockets/baileys";
import type { Boom } from "@hapi/boom";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const BOT_PREFIX = process.env.BOT_PREFIX || "> 🤖  *[BOT]*";
const DEFAULT_CMD_PREFIX = process.env.CMD_PREFIX || ".";
const REACTIONS = {
  working: process.env.WORKING_REACTION || "⚙️",
  error: process.env.ERROR_REACTION || "❌",
  done: process.env.DONE_REACTION || "✅",
};

const prisma = new PrismaClient();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function transcribeAudioMessage(message: proto.IWebMessageInfo) {
  const buffer = await downloadMediaMessage(message, "buffer", {});
  const file = new File([buffer], "audio.mp3", { type: "audio/mp3" });

  const temperature = await getChatTemperature(message.key.remoteJid!);
  const language = await getChatLanguage(message.key.remoteJid!);
  const prompt = await getChatTranscriptionPrompt(message.key.remoteJid!);

  const transcription = await groq.audio.transcriptions.create({
    file: file,
    model: "whisper-large-v3",
    response_format: "json",
    prompt,
    language,
    temperature,
  });

  return transcription.text.trim();
}

async function getUserFromId(userId: string | null | undefined) {
  if (!userId) return null;

  userId = appendDomainIfMissing(userId);
  return await prisma.whitelistedUser.findUnique({
    where: { userId },
  });
}

async function addUserToWhitelist(userId: string): Promise<void> {
  userId = appendDomainIfMissing(userId);
  await prisma.whitelistedUser.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function removeUserFromWhitelist(userId: string): Promise<void> {
  userId = appendDomainIfMissing(userId);
  await prisma.whitelistedUser.delete({
    where: { userId },
  });
}

async function getAllWhitelistedUsers(): Promise<string[]> {
  const users = await prisma.whitelistedUser.findMany();
  return users.map((u) => u.userId);
}

async function setChatLanguage(
  chatId: string,
  language: string
): Promise<void> {
  await prisma.chatSetting.upsert({
    where: { chatId_key: { chatId, key: "language" } },
    update: { value: language },
    create: { chatId, key: "language", value: language },
  });
}

async function deleteChatLanguage(chatId: string): Promise<void> {
  await prisma.chatSetting.delete({
    where: { chatId_key: { chatId, key: "language" } },
  });
}

async function setChatTranscriptionPrompt(
  chatId: string,
  transcriptionPrompt: string
): Promise<void> {
  await prisma.chatSetting.upsert({
    where: { chatId_key: { chatId, key: "transcriptionPrompt" } },
    update: { value: transcriptionPrompt },
    create: { chatId, key: "transcriptionPrompt", value: transcriptionPrompt },
  });
}

async function getChatTranscriptionPrompt(
  chatId: string
): Promise<string | undefined> {
  const setting = await prisma.chatSetting.findUnique({
    where: { chatId_key: { chatId, key: "transcriptionPrompt" } },
  });
  return setting?.value;
}

async function deleteChatTranscriptionPrompt(chatId: string): Promise<void> {
  await prisma.chatSetting.delete({
    where: { chatId_key: { chatId, key: "transcriptionPrompt" } },
  });
}

async function getChatLanguage(chatId: string): Promise<string | undefined> {
  const setting = await prisma.chatSetting.findUnique({
    where: { chatId_key: { chatId, key: "language" } },
  });
  return setting?.value;
}

async function setChatTemperature(chatId: string, temp: number): Promise<void> {
  await prisma.chatSetting.upsert({
    where: { chatId_key: { chatId, key: "temperature" } },
    update: { value: temp.toString() },
    create: { chatId, key: "temperature", value: temp.toString() },
  });
}

async function getChatTemperature(chatId: string): Promise<number> {
  const setting = await prisma.chatSetting.findUnique({
    where: { chatId_key: { chatId, key: "temperature" } },
  });
  return setting ? parseFloat(setting.value) : 0.0;
}

async function setCmdPrefix(prefix: string): Promise<void> {
  await prisma.globalSetting.upsert({
    where: { key: "cmd_prefix" },
    update: { value: prefix },
    create: { key: "cmd_prefix", value: prefix },
  });
}

async function getCmdPrefix(): Promise<string> {
  const setting = await prisma.globalSetting.findUnique({
    where: { key: "cmd_prefix" },
  });
  return setting ? setting.value : DEFAULT_CMD_PREFIX;
}

async function addAdmin(userId: string): Promise<void> {
  userId = appendDomainIfMissing(userId);
  await prisma.whitelistedUser.upsert({
    where: { userId },
    update: { isAdmin: true },
    create: { userId, isAdmin: true },
  });
}

async function removeAdmin(userId: string): Promise<void> {
  userId = appendDomainIfMissing(userId);
  await prisma.whitelistedUser.update({
    where: { userId },
    data: { isAdmin: false },
  });
}

async function listAdmins(): Promise<string[]> {
  const admins = await prisma.whitelistedUser.findMany({
    where: { isAdmin: true },
  });
  return admins.map((a) => a.userId);
}

async function setChatEnabled(chatId: string, enabled: boolean): Promise<void> {
  await prisma.chatSetting.upsert({
    where: { chatId_key: { chatId, key: "enabled" } },
    update: { value: enabled.toString() },
    create: { chatId, key: "enabled", value: enabled.toString() },
  });
}

async function isChatEnabled(chatId: string): Promise<boolean> {
  const setting = await prisma.chatSetting.findUnique({
    where: { chatId_key: { chatId, key: "enabled" } },
  });
  return setting ? setting.value === "true" : false;
}

function getHelpMessage(cmdPrefix: string): string {
  return `${BOT_PREFIX}\n\n*Available commands:*

- *${cmdPrefix}help* - Show this help message
- *${cmdPrefix}enable* - Enable the bot for this chat
- *${cmdPrefix}disable* - Disable the bot for this chat
- *${cmdPrefix}status* - Get bot status
- *${cmdPrefix}id* - Get current chat and user IDs
- *${cmdPrefix}temp _[value]_* - Set or get temperature _(Admin only)_
- *${cmdPrefix}lang <rm> _[language]_* - Set or get the transcription language _(Admin only)_
- *${cmdPrefix}prompt <rm> _[prompt]_* - Set or get the transcription prompt. Must be in the same language as the audio. _(Admin only)_
- *${cmdPrefix}prefix _[newPrefix]_* - Set or get command prefix
- *${cmdPrefix}user <add|rm|list> _[userId]_* - Manage whitelisted users
- *${cmdPrefix}admin <add|rm|list> _[userId]_* - Manage admins _(Admin only)_

*Aliases:*

- *${cmdPrefix}users* - Alias for '${cmdPrefix}user list'
- *${cmdPrefix}admins* - Alias for '${cmdPrefix}admin list'`;
}

async function handleCommand(
  command: string,
  args: string[],
  message: proto.IWebMessageInfo,
  isAdmin: boolean
): Promise<string> {
  try {
    const cmdPrefix = await getCmdPrefix();
    const chatId = message.key.remoteJid!;
    const isGroupChat = chatId.endsWith("@g.us");
    const userId = isGroupChat ? message.key.participant! : chatId;

    const isChatEnabledFlag = await isChatEnabled(chatId);

    // Handle enable/disable commands even when the bot is disabled
    if (command === `${cmdPrefix}enable`) {
      if (!isAdmin) {
        return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can enable the bot.`;
      }
      await setChatEnabled(chatId, true);
      return `${BOT_PREFIX}\n\n✅ Bot activated: The bot has been successfully enabled for this chat.`;
    } else if (command === `${cmdPrefix}disable`) {
      if (!isAdmin) {
        return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can disable the bot.`;
      }
      await setChatEnabled(chatId, false);
      return `${BOT_PREFIX}\n\n🛑 Bot deactivated: The bot has been disabled for this chat.`;
    }

    // Check if the bot is enabled for other commands
    if (!isChatEnabledFlag) {
      return `${BOT_PREFIX}\n\n🔒 Bot inactive: The bot is currently disabled for this chat. An administrator can enable it using \`${cmdPrefix}enable\`.`;
    }

    switch (command) {
      case `${cmdPrefix}id`:
        if (isGroupChat) {
          return `${BOT_PREFIX}\n\n🆔 Identifier information:
- Chat ID: \`${stripDomain(chatId)}\`
- User ID: \`${stripDomain(userId)}\``;
        } else {
          return `${BOT_PREFIX}\n\n🆔 Identifier information:
- Chat/User ID: \`${stripDomain(chatId)}\``;
        }
      case `${cmdPrefix}user`:
      case `${cmdPrefix}users`:
        if (command === `${cmdPrefix}users` || args[0] === "list") {
          const users = await getAllWhitelistedUsers();
          return `${BOT_PREFIX}\n\n👥 Whitelist:\n${users.join("\n")}`;
        } else if (args[0] === "add") {
          if (!isAdmin) {
            return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can add users to the whitelist.`;
          }
          const addUserId = args[1] || userId;
          await addUserToWhitelist(addUserId);
          return `${BOT_PREFIX}\n\n✅ User whitelisted: ${stripDomain(
            addUserId
          )} has been added to the whitelist.`;
        } else if (args[0] === "rm") {
          if (!isAdmin) {
            return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can remove users from the whitelist.`;
          }
          const rmUserId = args[1] || userId;
          await removeUserFromWhitelist(rmUserId);
          return `${BOT_PREFIX}\n\n🗑️ User removed: ${stripDomain(
            rmUserId
          )} has been removed from the whitelist.`;
        } else {
          return `${BOT_PREFIX}\n\n❓ Invalid subcommand: Please use \`add\`, \`rm\`, or \`list\` with the user command.`;
        }
      case `${cmdPrefix}temp`:
        if (!isAdmin) {
          return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can manage temperature settings.`;
        }
        if (args.length > 0) {
          const temp = parseFloat(args[0]);
          if (isNaN(temp) || temp < 0.0 || temp > 1.0) {
            return `${BOT_PREFIX}\n\n❌ Invalid input: Temperature must be a number between 0.0 and 1.0.`;
          }
          await setChatTemperature(chatId, temp);
          return `${BOT_PREFIX}\n\n🌡️ Temperature updated: Set to ${temp} for this chat.`;
        } else {
          const currentTemp = await getChatTemperature(chatId);
          return `${BOT_PREFIX}\n\n🌡️ Current temperature: ${currentTemp} for this chat.`;
        }
      case `${cmdPrefix}lang`:
        if (!isAdmin) {
          return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can manage language settings.`;
        }
        if (args.length > 0) {
          // if args[0] is "rm", remove the language
          if (args[0] === "rm") {
            await deleteChatLanguage(chatId);
            return `${BOT_PREFIX}\n\n🗑️ Language removed: The transcription language has been cleared for this chat.`;
          }
          const lang = args.join(" ");
          await setChatLanguage(chatId, lang);
          return `${BOT_PREFIX}\n\n🌐 Language updated: The transcription language has been set to "${lang}".`;
        } else {
          const currentLang = await getChatLanguage(chatId);
          return `${BOT_PREFIX}\n\n🌐 Current language: The transcription language is set to "${currentLang}".`;
        }
      case `${cmdPrefix}prompt`:
        if (!isAdmin) {
          return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can manage transcription prompts.`;
        }
        if (args.length > 0) {
          // if args[0] is "rm", remove the prompt
          if (args[0] === "rm") {
            await deleteChatTranscriptionPrompt(chatId);
            return `${BOT_PREFIX}\n\n🗑️ Prompt removed: The transcription prompt has been cleared for this chat.`;
          }
          const prompt = args.join(" ");
          await setChatTranscriptionPrompt(chatId, prompt);
          return `${BOT_PREFIX}\n\n📝 Prompt updated: The transcription prompt has been set to "${prompt}".`;
        } else {
          const currentPrompt = await getChatTranscriptionPrompt(chatId);
          return `${BOT_PREFIX}\n\n📝 Current prompt: The transcription prompt is set to "${currentPrompt}".`;
        }
      case `${cmdPrefix}prefix`:
        if (args.length > 0) {
          if (!isAdmin) {
            return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can change the command prefix.`;
          }
          const newPrefix = args[0];
          await setCmdPrefix(newPrefix);
          return `${BOT_PREFIX}\n\n✏️ Prefix updated: Command prefix set to "${newPrefix}".`;
        } else {
          return `${BOT_PREFIX}\n\n🔤 Current prefix: The command prefix is "${cmdPrefix}".`;
        }
      case `${cmdPrefix}help`:
        return getHelpMessage(cmdPrefix);
      case `${cmdPrefix}admin`:
      case `${cmdPrefix}admins`:
        if (!isAdmin) {
          return `${BOT_PREFIX}\n\n⛔ Access denied: Only administrators can use this command.`;
        }
        if (command === `${cmdPrefix}admins` || args[0] === "list") {
          const admins = await listAdmins();
          return `${BOT_PREFIX}\n\n👑 Administrators:\n${admins.join("\n")}`;
        }
        const subCommand = args[0];
        const adminUserId = args[1];
        switch (subCommand) {
          case "add":
            if (!adminUserId)
              return `${BOT_PREFIX}\n\n❌ Missing information: Please provide a user ID to add as an administrator.`;
            await addAdmin(adminUserId);
            return `${BOT_PREFIX}\n\n👑 Administrator added: ${stripDomain(
              adminUserId
            )} is now an administrator.`;
          case "rm":
            if (!adminUserId)
              return `${BOT_PREFIX}\n\n❌ Missing information: Please provide a user ID to remove as an administrator.`;
            if (adminUserId === userId) {
              return `${BOT_PREFIX}\n\n❌ Action denied: You cannot remove yourself as an administrator.`;
            }
            await removeAdmin(adminUserId);
            return `${BOT_PREFIX}\n\n🔽 Administrator removed: ${stripDomain(
              adminUserId
            )} is no longer an administrator.`;
          default:
            return `${BOT_PREFIX}\n\n❓ Invalid subcommand: Please use \`add\`, \`rm\`, or \`list\` with the admin command.`;
        }
      case `${cmdPrefix}status`:
        const chatStatus = isChatEnabledFlag ? "enabled" : "disabled";
        const chatTemp = await getChatTemperature(chatId);
        const currentPrefix = await getCmdPrefix();
        const chatLang = await getChatLanguage(chatId);
        const chatPrompt = await getChatTranscriptionPrompt(chatId);
        return `${BOT_PREFIX}\n\n📊 Bot status:

- Chat: *${chatStatus}*
- Temperature: *${chatTemp}*
- Language: *${chatLang || "Not set"}*
- Prompt: *${chatPrompt || "Not set"}*
- Command Prefix: *${currentPrefix}*
- Chat ID: \`${stripDomain(chatId)}\`
- User ID: \`${stripDomain(userId)}\``;
      default:
        return `${BOT_PREFIX}\n\n❓ Unknown command: \`${command}\`. Type ${cmdPrefix}help for available commands.`;
    }
  } catch (error) {
    console.error(`Error handling command ${command}:`, error);
    return `${BOT_PREFIX}\n\n🚫 Error occurred: An unexpected error happened while processing the command.\nDetails:\n\n${JSON.stringify(
      error
    )}`;
  }
}

function stripDomain(userId: string): string {
  return userId.split("@")[0];
}

function appendDomainIfMissing(userId: string): string {
  if (!userId.includes("@")) {
    return `${userId}@s.whatsapp.net`;
  }
  return userId;
}

async function ensureAdmins() {
  const adminUserIds = process.env.ADMIN_USER_IDS?.split(",") || [];
  for (let userId of adminUserIds) {
    userId = appendDomainIfMissing(userId);
    await addAdmin(userId);
  }
}

async function isUserAuthorized(
  message: proto.IWebMessageInfo
): Promise<boolean> {
  const chatId = message.key.remoteJid!;
  const isGroupChat = chatId.endsWith("@g.us");
  const userId = isGroupChat ? message.key.participant! : chatId;

  const user = await getUserFromId(userId);

  return user?.isAdmin || !!user;
}

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const socket = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  async function reactToMessage(options: ReactToMessageOptions) {
    return await socket.sendMessage(options.chatId, {
      react: {
        text: REACTIONS[options.reaction],
        key: {
          remoteJid: options.message.key.remoteJid!,
          fromMe: false,
          id: options.message.key.id,
        },
      },
    });
  }

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect!.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log(
        "connection closed due to ",
        lastDisconnect!.error,
        ", reconnecting ",
        shouldReconnect
      );

      if (shouldReconnect) {
        main();
      }
    } else if (connection === "open") {
      console.log("opened connection");
    }
  });

  socket.ev.on("messages.upsert", async (m) => {
    if (m.messages.length > 1) return;
    const message = m.messages[0];
    if (!message) return;

    console.dir({ ...message, message: message.message }, { depth: null });

    const isAuthorized = await isUserAuthorized(message);
    if (!isAuthorized) return;

    const TEXT = message.message?.conversation;
    if (TEXT) {
      const cmdPrefix = await getCmdPrefix();
      if (TEXT.startsWith(cmdPrefix)) {
        const [command, ...args] = TEXT.split(" ");
        try {
          const userId = message.key.participant || message.key.remoteJid!;
          const user = await getUserFromId(userId);
          // TODO: isAdmin should verify if the sender is admin, not the receiver (remoteJid/user.isAdmin)
          // using message.key.fromMe for now
          const isAdmin = user?.isAdmin || message.key.fromMe || false;
          const response = await handleCommand(command, args, message, isAdmin);
          await socket.sendMessage(
            message.key.remoteJid!,
            { text: response },
            { quoted: message }
          );
        } catch (error) {
          console.error("Error processing command:", error);
          const errorMessage = `${BOT_PREFIX}\n\n🚫 Command processing error: An unexpected issue occurred while handling your request.\nDetails:\n\n${JSON.stringify(
            error
          )}`;
          await socket.sendMessage(
            message.key.remoteJid!,
            { text: errorMessage },
            { quoted: message }
          );
        }
      }
    }

    const chatId = message.key.remoteJid!;
    const isChatEnabledFlag = await isChatEnabled(chatId);
    if (!isChatEnabledFlag) return;

    const isAudio = message.message?.audioMessage;
    if (!isAudio) return;

    await reactToMessage({
      chatId: chatId,
      message,
      reaction: "working",
    });

    try {
      const transcription = await transcribeAudioMessage(message);
      const response = `${BOT_PREFIX}\n\n${transcription}`;

      await socket.sendMessage(chatId, { text: response }, { quoted: message });
      await reactToMessage({
        chatId: chatId,
        message,
        reaction: "done",
      });
    } catch (error) {
      console.error(error);
      const errorMessage = `${BOT_PREFIX}\n\n🚫 Transcription error: An issue occurred while processing the audio message.\nDetails:\n\n${JSON.stringify(
        error
      )}`;
      await socket.sendMessage(
        chatId,
        { text: errorMessage },
        { quoted: message }
      );
      await reactToMessage({
        chatId: chatId,
        message,
        reaction: "error",
      });
    }
  });
}

interface ReactToMessageOptions {
  chatId: string;
  message: proto.IWebMessageInfo;
  reaction: keyof typeof REACTIONS;
}

// Initialize and run the bot
async function initializeBot() {
  await ensureAdmins();
  await main();
}

initializeBot().catch(console.error);

// Export types for Prisma schema
export type { PrismaClient };
