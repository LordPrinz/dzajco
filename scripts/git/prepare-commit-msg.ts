// Prefixes the commit message with the ticket from the branch name: DZAJ-44-foo → "[DZAJ-44] …".
import { currentBranch, needsTicketPrefix, ticketFromBranch } from "./conventions.ts";

const [messageFile, source] = Bun.argv.slice(2);
if (!messageFile || source === "merge" || source === "squash" || source === "commit") {
  process.exit(0);
}

const ticket = ticketFromBranch(await currentBranch());
if (!ticket) process.exit(0);

const message = await Bun.file(messageFile).text();
if (needsTicketPrefix(message)) {
  await Bun.write(messageFile, `[${ticket}] ${message}`);
}
