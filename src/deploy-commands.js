import { initDb } from "./db.js";
import { deployCommands } from "./commands.js";

initDb();
await deployCommands();
