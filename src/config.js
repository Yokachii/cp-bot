// config.js
import dotenv from "dotenv";
dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  token: required("DISCORD_TOKEN"),
  clientId: required("CLIENT_ID"),
  guildId: process.env.GUILD_ID || null,
  dailyQuestionCron: process.env.DAILY_QUESTION_CRON || "0 9 * * *",
  dailyQuestionTimezone: process.env.DAILY_QUESTION_TIMEZONE || "Europe/Paris",
};
