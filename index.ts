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

const prisma = new PrismaClient();
const BOT_PREFIX = process.env.BOT_PREFIX || "> 🤖  *[BOT]*";
const DEFAULT_CMD_PREFIX = process.env.CMD_PREFIX || ".";
const REACTIONS = {
  working: process.env.WORKING_REACTION || "⚙️",
  error: process.env.ERROR_REACTION || "❌",
  done: process.env.DONE_REACTION || "✅",
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function transcribeAudioMessage(message: proto.IWebMessageInfo) {
  const buffer = await downloadMediaMessage(message, "buffer", {});
  const file = new File([buffer], "audio.mp3", { type: "audio/mp3" });

  const temperature = await getChatTemperature(message.key.remoteJid!);

  const transcription = await groq.audio.transcriptions.create({
    file: file,
    model: "whisper-large-v3",
    response_format: "json",
    temperature: temperature,
  });

  return transcription.text.trim();
}

async function getUserFromJID(jid: string | null | undefined) {
  if (!jid) return null;

  jid = appendDomainIfMissing(jid);
  return await prisma.whitelistedJID.findUnique({
    where: { jid },
  });
}

async function addJIDToWhitelist(jid: string): Promise<void> {
  jid = appendDomainIfMissing(jid);
  await prisma.whitelistedJID.upsert({
    where: { jid },
    update: {},
    create: { jid },
  });
}

async function removeJIDFromWhitelist(jid: string): Promise<void> {
  jid = appendDomainIfMissing(jid);
  await prisma.whitelistedJID.delete({
    where: { jid },
  });
}

async function getAllWhitelistedJIDs(): Promise<string[]> {
  const jids = await prisma.whitelistedJID.findMany();
  return jids.map((j) => j.jid);
}

async function setChatTemperature(
  chatJid: string,
  temp: number
): Promise<void> {
  await prisma.chatSetting.upsert({
    where: { chatJid_key: { chatJid, key: "temperature" } },
    update: { value: temp.toString() },
    create: { chatJid, key: "temperature", value: temp.toString() },
  });
}

async function getChatTemperature(chatJid: string): Promise<number> {
  const setting = await prisma.chatSetting.findUnique({
    where: { chatJid_key: { chatJid, key: "temperature" } },
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

async function addAdmin(jid: string): Promise<void> {
  jid = appendDomainIfMissing(jid);
  await prisma.whitelistedJID.upsert({
    where: { jid },
    update: { isAdmin: true },
    create: { jid, isAdmin: true },
  });
}

async function removeAdmin(jid: string): Promise<void> {
  jid = appendDomainIfMissing(jid);
  await prisma.whitelistedJID.update({
    where: { jid },
    data: { isAdmin: false },
  });
}

async function listAdmins(): Promise<string[]> {
  const admins = await prisma.whitelistedJID.findMany({
    where: { isAdmin: true },
  });
  return admins.map((a) => a.jid);
}

function getHelpMessage(cmdPrefix: string): string {
  return `${BOT_PREFIX}\n\nAvailable commands:
  ${cmdPrefix}jid - Get the current JID(s)
  ${cmdPrefix}add [jid] - Add JID to whitelist
  ${cmdPrefix}del [jid] - Remove JID from whitelist
  ${cmdPrefix}temp [value] - Set or get temperature (Admin only)
  ${cmdPrefix}jids - List all whitelisted JIDs
  ${cmdPrefix}prefix [new_prefix] - Set or get command prefix
  ${cmdPrefix}help - Show this help message
  ${cmdPrefix}admin add|del|list [jid] - Manage admins (Admin only)

Examples:
  ${cmdPrefix}temp 0.7
  ${cmdPrefix}add 1234567890@g.us
  ${cmdPrefix}jids
  ${cmdPrefix}prefix !
  ${cmdPrefix}admin add 1234567890@s.whatsapp.net`;
}

async function handleCommand(
  command: string,
  args: string[],
  message: proto.IWebMessageInfo,
  isAdmin: boolean
): Promise<string> {
  try {
    const cmdPrefix = await getCmdPrefix();
    const chatJid = message.key.remoteJid!;
    const isGroupChat = chatJid.endsWith("@g.us");
    const participantJid = message.key.participant;

    switch (command) {
      case `${cmdPrefix}jid`:
        if (isGroupChat) {
          return `${BOT_PREFIX}\n\nChat JID: ${chatJid}\nParticipant JID: ${participantJid}`;
        } else {
          return `${BOT_PREFIX}\n\nChat JID: ${chatJid}`;
        }
      case `${cmdPrefix}add`:
        if (args.length === 0) {
          await addJIDToWhitelist(isGroupChat ? participantJid! : chatJid);
          return `${BOT_PREFIX}\n\nAdded ${
            isGroupChat ? participantJid : chatJid
          } to whitelist.`;
        } else {
          const newJID = args[0];
          await addJIDToWhitelist(newJID);
          return `${BOT_PREFIX}\n\nAdded ${newJID} to whitelist.`;
        }
      case `${cmdPrefix}del`:
        if (args.length === 0) {
          await removeJIDFromWhitelist(isGroupChat ? participantJid! : chatJid);
          return `${BOT_PREFIX}\n\nRemoved ${
            isGroupChat ? participantJid : chatJid
          } from whitelist.`;
        } else {
          const delJID = args[0];
          await removeJIDFromWhitelist(delJID);
          return `${BOT_PREFIX}\n\nRemoved ${delJID} from whitelist.`;
        }
      case `${cmdPrefix}temp`:
        if (!isAdmin) {
          return `${BOT_PREFIX}\n\nOnly admins can use this command.`;
        }
        if (args.length > 0) {
          const temp = parseFloat(args[0]);
          if (isNaN(temp) || temp < 0.0 || temp > 1.0) {
            return `${BOT_PREFIX}\n\nInvalid temperature value. Must be between 0.0 and 1.0.`;
          }
          await setChatTemperature(chatJid, temp);
          return `${BOT_PREFIX}\n\nSet temperature for this chat to ${temp}.`;
        } else {
          const currentTemp = await getChatTemperature(chatJid);
          return `${BOT_PREFIX}\n\nCurrent temperature for this chat: ${currentTemp}`;
        }
      case `${cmdPrefix}jids`:
        const jids = await getAllWhitelistedJIDs();
        return `${BOT_PREFIX}\n\nWhitelisted JIDs:\n${jids.join("\n")}`;
      case `${cmdPrefix}prefix`:
        if (args.length > 0) {
          const newPrefix = args[0];
          await setCmdPrefix(newPrefix);
          return `${BOT_PREFIX}\n\nSet command prefix to "${newPrefix}".`;
        } else {
          return `${BOT_PREFIX}\n\nCurrent command prefix: "${cmdPrefix}"`;
        }
      case `${cmdPrefix}help`:
        return getHelpMessage(cmdPrefix);
      case `${cmdPrefix}admin`:
        if (!isAdmin) {
          return `${BOT_PREFIX}\n\nOnly admins can use this command.`;
        }
        const subCommand = args[0];
        const adminJid = args[1];
        switch (subCommand) {
          case "add":
            if (!adminJid)
              return `${BOT_PREFIX}\n\nPlease provide a JID to add as admin.`;
            await addAdmin(adminJid);
            return `${BOT_PREFIX}\n\nAdded ${adminJid} as admin.`;
          case "del":
            if (!adminJid)
              return `${BOT_PREFIX}\n\nPlease provide a JID to remove as admin.`;
            if (adminJid === message.key.participant) {
              return `${BOT_PREFIX}\n\nYou cannot remove yourself as an admin.`;
            }
            await removeAdmin(adminJid);
            return `${BOT_PREFIX}\n\nRemoved ${adminJid} as admin.`;
          case "list":
            const admins = await listAdmins();
            return `${BOT_PREFIX}\n\nAdmin JIDs:\n${admins.join("\n")}`;
          default:
            return `${BOT_PREFIX}\n\nInvalid admin subcommand. Use add, del, or list.`;
        }
      default:
        return `${BOT_PREFIX}\n\nUnknown command. Type ${cmdPrefix}help for available commands.`;
    }
  } catch (error) {
    console.error(`Error handling command ${command}:`, error);
    return `${BOT_PREFIX}\n\nAn error occurred while processing the command: ${JSON.stringify(
      error
    )}`;
  }
}

function appendDomainIfMissing(jid: string): string {
  if (!jid.includes("@")) {
    return `${jid}@s.whatsapp.net`;
  }
  return jid;
}

async function ensureAdmins() {
  const adminJids = process.env.ADMIN_JIDS?.split(",") || [];
  for (let jid of adminJids) {
    jid = appendDomainIfMissing(jid);
    await addAdmin(jid);
  }
}

async function isUserAuthorized(
  message: proto.IWebMessageInfo
): Promise<boolean> {
  const chatJid = message.key.remoteJid!;
  const participantJid = message.key.participant;
  const isGroupChat = chatJid.endsWith("@g.us");

  const chatUser = await getUserFromJID(chatJid);
  const participantUser = isGroupChat
    ? await getUserFromJID(participantJid)
    : null;

  if (participantUser?.isAdmin || chatUser?.isAdmin) return true;

  if (isGroupChat) {
    return !!participantUser || !!chatUser;
  } else {
    return !!chatUser;
  }
}

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const socket = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  async function reactToMessage(options: ReactToMessageOptions) {
    return await socket.sendMessage(options.jid, {
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

    const isAuthorized = await isUserAuthorized(message);
    if (!isAuthorized) return;

    const TEXT = message.message?.conversation;
    if (TEXT) {
      const cmdPrefix = await getCmdPrefix();
      if (TEXT.startsWith(cmdPrefix)) {
        const [command, ...args] = TEXT.split(" ");
        try {
          const user = await getUserFromJID(
            message.key.participant || message.key.remoteJid
          );
          const isAdmin = user?.isAdmin || false;
          const response = await handleCommand(command, args, message, isAdmin);
          await socket.sendMessage(
            message.key.remoteJid!,
            { text: response },
            { quoted: message }
          );
        } catch (error) {
          console.error("Error processing command:", error);
          const errorMessage = `${BOT_PREFIX}\n\nAn error occurred while processing the command:\n\n${JSON.stringify(
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

    const isAudio = message.message?.audioMessage;
    if (!isAudio) return;

    await reactToMessage({
      jid: message.key.remoteJid!,
      message,
      reaction: "working",
    });

    try {
      const transcription = await transcribeAudioMessage(message);
      const response = `${BOT_PREFIX}\n\n${transcription}`;

      await socket.sendMessage(
        message.key.remoteJid!,
        { text: response },
        { quoted: message }
      );
      await reactToMessage({
        jid: message.key.remoteJid!,
        message,
        reaction: "done",
      });
    } catch (error) {
      console.error(error);
      const errorMessage = `${BOT_PREFIX}\n\nAn error occurred while processing the audio message:\n\n${JSON.stringify(
        error
      )}`;
      await socket.sendMessage(
        message.key.remoteJid!,
        { text: errorMessage },
        { quoted: message }
      );
      await reactToMessage({
        jid: message.key.remoteJid!,
        message,
        reaction: "error",
      });
    }
  });
}

interface ReactToMessageOptions {
  jid: string;
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
