import {
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import { config } from "./config.js";

export const commandData = [
  new SlashCommandBuilder()
    .setName("couple")
    .setDescription("Manage your couple profile")
    .addSubcommand((sub) =>
      sub
        .setName("pair")
        .setDescription("Invite someone to be your partner")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Your partner")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("leave").setDescription("Unlink your couple profile")
    )
    .addSubcommand((sub) =>
      sub
        .setName("channels")
        .setDescription("Set where each feature posts (leave empty to view)")
        .addChannelOption((option) =>
          option
            .setName("questions")
            .setDescription("Channel for question reveals")
        )
        .addChannelOption((option) =>
          option
            .setName("quizzes")
            .setDescription("Channel for quiz recaps")
        )
        .addChannelOption((option) =>
          option
            .setName("bucketlist")
            .setDescription("Channel for the permanent bucket-list message")
        )
        .addChannelOption((option) =>
          option
            .setName("habits")
            .setDescription("Channel for habit updates")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Personalize your couple card")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Your couple name")
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName("since")
            .setDescription("Together since, YYYY-MM-DD")
        )
        .addStringOption((option) =>
          option
            .setName("my_birthday")
            .setDescription("Your birthday, YYYY-MM-DD")
        )
        .addStringOption((option) =>
          option
            .setName("partner_birthday")
            .setDescription("Your partner's birthday, YYYY-MM-DD")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("info").setDescription("Show your couple profile")
    ),
  new SlashCommandBuilder()
    .setName("question")
    .setDescription("Send both of you a random couple question")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("Optional deck (love maps, repair, fun, …)")
        .setAutocomplete(true)
    ),
  new SlashCommandBuilder()
    .setName("decks")
    .setDescription("See question decks and how many questions are left")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("A specific deck to inspect (leave empty for all decks)")
        .setAutocomplete(true)
    ),
  new SlashCommandBuilder()
    .setName("quiz")
    .setDescription("How well do you know each other?")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a 5-question guess-your-partner quiz")
        .addStringOption((option) =>
          option
            .setName("pack")
            .setDescription("Quiz pack (leave empty for a random unused quiz)")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("quiz")
            .setDescription("A specific quiz inside the pack")
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("packs").setDescription("List quiz packs")
    ),
  new SlashCommandBuilder()
    .setName("bucketlist")
    .setDescription("Shared dreams, trips, movies, and goals")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add something you want to do together")
        .addStringOption((option) =>
          option
            .setName("idea")
            .setDescription("Title of the objective")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Extra details about the objective")
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("An emoji for this objective (default 🌟)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("complete")
        .setDescription("Check an objective off the list by its number")
        .addIntegerOption((option) =>
          option
            .setName("goal")
            .setDescription("The #number shown on the list")
            .setRequired(true)
            .setMinValue(0)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Delete an objective from the list by its number")
        .addIntegerOption((option) =>
          option
            .setName("goal")
            .setDescription("The #number shown on the list")
            .setRequired(true)
            .setMinValue(0)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Show your visual checklist")
    )
    .addSubcommand((sub) =>
      sub
        .setName("resend")
        .setDescription("Re-post the permanent bucket-list message if it was deleted")
    ),
  new SlashCommandBuilder()
    .setName("memory")
    .setDescription("Time capsule and throwbacks")
    .addSubcommand((sub) =>
      sub
        .setName("save")
        .setDescription("Log a memory (photo + caption)")
        .addStringOption((option) =>
          option
            .setName("caption")
            .setDescription("What happened")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("photo_url")
            .setDescription("Link to a photo")
        )
        .addAttachmentOption((option) =>
          option.setName("photo").setDescription("Or upload a photo")
        )
        .addStringOption((option) =>
          option
            .setName("when")
            .setDescription("Date of the memory, YYYY-MM-DD (default: today)")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("random").setDescription("Draw a random memory to relive")
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Recent memories")
    ),
  new SlashCommandBuilder()
    .setName("habit")
    .setDescription("Track couple habits")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Create a habit for yourself")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Habit name")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("goal_per_day")
            .setDescription("Goal per day (default: 1)")
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("log")
        .setDescription("Log that you did a habit")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Habit name")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option.setName("note").setDescription("Optional note")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List your personal habits with streaks")
    )
    .addSubcommand((sub) =>
      sub.setName("view-partner").setDescription("See your partner's habits and progress")
    ),
  new SlashCommandBuilder()
    .setName("mood")
    .setDescription("Share how you feel right now")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set your current mood")
        .addStringOption((option) =>
          option
            .setName("mood")
            .setDescription("Pick a preset or type your own")
            .setRequired(true)
            .setMaxLength(60)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("An emoji for your mood (custom moods, or to override a preset)")
            .setMaxLength(32)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("How you feel, in your own words")
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("See both of your current moods")
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Clear your current mood")
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("See every command and what it does"),
].map((command) => command.toJSON());

export async function deployCommands() {
  const rest = new REST({ version: "10" }).setToken(config.token);

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commandData,
    });
    console.log(`Registered guild commands in ${config.guildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.clientId), {
    body: commandData,
  });
  console.log("Registered global slash commands");
}
