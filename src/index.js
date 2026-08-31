import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config.js";
import { initDb } from "./db.js";
import { deployCommands } from "./commands.js";
import { handleInteraction } from "./interactions.js";
import { startScheduler } from "./scheduler.js";

initDb();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await deployCommands();
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
  startScheduler(readyClient);
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction);
});

client.login(config.token);
