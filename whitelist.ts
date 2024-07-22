import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addUser(userId: string) {
  await prisma.whitelistedUser.create({
    data: { userId },
  });
  console.log(`Added ${userId} to whitelist.`);
}

async function removeUser(userId: string) {
  await prisma.whitelistedUser.delete({
    where: { userId },
  });
  console.log(`Removed ${userId} from whitelist.`);
}

async function listUsers() {
  const users = await prisma.whitelistedUser.findMany();
  console.log("Whitelisted Users:");
  users.forEach((user) =>
    console.log(`${user.userId}${user.isAdmin ? " (Admin)" : ""}`)
  );
}

async function addAdmin(userId: string) {
  await prisma.whitelistedUser.upsert({
    where: { userId },
    update: { isAdmin: true },
    create: { userId, isAdmin: true },
  });
  console.log(`Added ${userId} as an admin.`);
}

async function removeAdmin(userId: string) {
  await prisma.whitelistedUser.update({
    where: { userId },
    data: { isAdmin: false },
  });
  console.log(`Removed admin status from ${userId}.`);
}

function printHelp() {
  console.log(`
Usage: bun run whitelist <command> [userId]

Commands:
  add <userId>     Add a user to the whitelist
  remove <userId>  Remove a user from the whitelist
  list             List all whitelisted users
  addadmin <userId> Add a user as an admin
  removeadmin <userId> Remove admin status from a user
  help             Show this help message

Example:
  bun run whitelist add 1234567890@s.whatsapp.net
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const userId = args[1];

  try {
    switch (command) {
      case "add":
        if (!userId) throw new Error("UserId is required for add command");
        await addUser(userId);
        break;
      case "remove":
        if (!userId) throw new Error("UserId is required for remove command");
        await removeUser(userId);
        break;
      case "list":
        await listUsers();
        break;
      case "addadmin":
        if (!userId) throw new Error("UserId is required for addadmin command");
        await addAdmin(userId);
        break;
      case "removeadmin":
        if (!userId)
          throw new Error("UserId is required for removeadmin command");
        await removeAdmin(userId);
        break;
      case "help":
      case "--help":
        printHelp();
        break;
      default:
        console.log("Invalid command. Use 'help' for usage information.");
        printHelp();
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
