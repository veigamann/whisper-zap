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

  const temperature = await getTemperatureSetting();

  const transcription = await groq.audio.transcriptions.create({
    file: file,
    model: "whisper-large-v3",
    response_format: "json",
    temperature: temperature,
  });

  return transcription.text.trim();
}

async function isJIDWhitelisted(jid: string): Promise<boolean> {
  const count = await prisma.whitelistedJID.count({
    where: { jid },
  });
  return count > 0;
}

async function addJIDToWhitelist(jid: string): Promise<void> {
  await prisma.whitelistedJID.create({
    data: { jid },
  });
}

async function removeJIDFromWhitelist(jid: string): Promise<void> {
  await prisma.whitelistedJID.delete({
    where: { jid },
  });
}

async function getAllWhitelistedJIDs(): Promise<string[]> {
  const jids = await prisma.whitelistedJID.findMany();
  return jids.map((j) => j.jid);
}

async function setTemperature(temp: number): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "temperature" },
    update: { value: temp.toString() },
    create: { key: "temperature", value: temp.toString() },
  });
}

async function getTemperatureSetting(): Promise<number> {
  const setting = await prisma.setting.findUnique({
    where: { key: "temperature" },
  });
  return setting ? parseFloat(setting.value) : 0.0;
}

async function setCmdPrefix(prefix: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "cmd_prefix" },
    update: { value: prefix },
    create: { key: "cmd_prefix", value: prefix },
  });
}

async function getCmdPrefix(): Promise<string> {
  const setting = await prisma.setting.findUnique({
    where: { key: "cmd_prefix" },
  });
  return setting ? setting.value : DEFAULT_CMD_PREFIX;
}

function getHelpMessage(cmdPrefix: string): string {
  return `${BOT_PREFIX}\n\nAvailable commands:
  ${cmdPrefix}jid - Get the current JID
  ${cmdPrefix}add - Add current JID to whitelist
  ${cmdPrefix}del - Remove current JID from whitelist
  ${cmdPrefix}temp [value] - Set or get temperature
  ${cmdPrefix}jids - List all whitelisted JIDs
  ${cmdPrefix}prefix [new_prefix] - Set or get command prefix
  ${cmdPrefix}help - Show this help message

Examples:
  ${cmdPrefix}temp 0.7
  ${cmdPrefix}add
  ${cmdPrefix}jids
  ${cmdPrefix}prefix !`;
}

async function handleCommand(
  command: string,
  args: string[],
  JID: string
): Promise<string> {
  try {
    const cmdPrefix = await getCmdPrefix();
    switch (command) {
      case `${cmdPrefix}jid`:
        return `${BOT_PREFIX}\n\n${JID}`;
      case `${cmdPrefix}add`:
        await addJIDToWhitelist(JID);
        return `${BOT_PREFIX}\n\nAdded ${JID} to whitelist.`;
      case `${cmdPrefix}del`:
        await removeJIDFromWhitelist(JID);
        return `${BOT_PREFIX}\n\nRemoved ${JID} from whitelist.`;
      case `${cmdPrefix}temp`:
        if (args.length > 0) {
          const temp = parseFloat(args[0]);
          if (!isNaN(temp)) {
            await setTemperature(temp);
            return `${BOT_PREFIX}\n\nSet temperature to ${temp}.`;
          } else {
            return `${BOT_PREFIX}\n\nInvalid temperature value.`;
          }
        } else {
          const currentTemp = await getTemperatureSetting();
          return `${BOT_PREFIX}\n\nCurrent temperature: ${currentTemp}`;
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

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const socket = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  async function reactToMessage({
    jid,
    message,
    reaction,
  }: ReactToMessageOptions) {
    return await socket.sendMessage(jid, {
      react: {
        text: REACTIONS[reaction],
        key: {
          remoteJid: message.key.remoteJid!,
          fromMe: false,
          id: message.key.id,
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

      // reconnect if not logged out
      if (shouldReconnect) {
        main();
      }
    } else if (connection === "open") {
      console.log("opened connection");
    }
  });

  socket.ev.on("messages.upsert", async (m) => {
    console.dir(m.messages[0], { depth: null });
    const message = m.messages[0];
    if (!message) return;

    const JID = message.key.remoteJid;
    if (!JID) return;

    if (!(await isJIDWhitelisted(JID))) return;

    const TEXT = message.message?.conversation;
    if (TEXT) {
      const cmdPrefix = await getCmdPrefix();
      if (TEXT.startsWith(cmdPrefix)) {
        const [command, ...args] = TEXT.split(" ");
        try {
          const response = await handleCommand(command, args, JID);
          await socket.sendMessage(
            JID,
            { text: response },
            { quoted: message }
          );
        } catch (error) {
          console.error("Error processing command:", error);
          const errorMessage = `${BOT_PREFIX}\n\nAn error occurred while processing the command:\n\n${JSON.stringify(
            error
          )}`;
          await socket.sendMessage(
            JID,
            { text: errorMessage },
            { quoted: message }
          );
        }
      }
    }

    const isAudio = message.message?.audioMessage;
    if (!isAudio) return;

    if (!(await isJIDWhitelisted(JID))) return;

    await reactToMessage({
      jid: JID,
      message,
      reaction: "working",
    });

    try {
      const transcription = await transcribeAudioMessage(message);
      const response = `${BOT_PREFIX}\n\n${transcription}`;

      await socket.sendMessage(JID, { text: response }, { quoted: message });
      await reactToMessage({
        jid: JID,
        message,
        reaction: "done",
      });
    } catch (error) {
      console.error(error);
      const errorMessage = `${BOT_PREFIX}\n\nAn error occurred while processing the audio message:\n\n${JSON.stringify(
        error
      )}`;
      await socket.sendMessage(
        JID,
        { text: errorMessage },
        { quoted: message }
      );
      await reactToMessage({
        jid: JID,
        message,
        reaction: "error",
      });
    }
  });
}

main();

interface ReactToMessageOptions {
  jid: string;
  message: proto.IWebMessageInfo;
  reaction: keyof typeof REACTIONS;
}
