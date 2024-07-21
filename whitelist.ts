import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addJID(jid: string) {
  await prisma.whitelistedJID.create({
    data: { jid },
  });
  console.log(`Added ${jid} to whitelist.`);
}

async function removeJID(jid: string) {
  await prisma.whitelistedJID.delete({
    where: { jid },
  });
  console.log(`Removed ${jid} from whitelist.`);
}

async function listJIDs() {
  const jids = await prisma.whitelistedJID.findMany();
  console.log("Whitelisted JIDs:");
  jids.forEach((j) => console.log(j.jid));
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const jid = args[1];

  try {
    switch (command) {
      case "add":
        if (!jid) throw new Error("JID is required for add command");
        await addJID(jid);
        break;
      case "remove":
        if (!jid) throw new Error("JID is required for remove command");
        await removeJID(jid);
        break;
      case "list":
        await listJIDs();
        break;
      default:
        console.log("Usage: bun run whitelist <add|remove|list> [JID]");
    }
  } catch (error) {
    console.error(JSON.stringify(error));
  } finally {
    await prisma.$disconnect();
  }
}

main();
