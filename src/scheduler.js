import cron from "node-cron";
import { config } from "./config.js";
import { getCoupleById, listCouples } from "./couples.js";
import { sendQuestionToCouple } from "./interactions.js";
import {
  getTodayInZone,
  markThrowbackSent,
  memoriesOnThisDay,
  memoryEmbed,
  yearsAgo,
} from "./memories.js";
import { sendToCouple } from "./notify.js";

export function startScheduler(client) {
  if (!cron.validate(config.dailyQuestionCron)) {
    console.warn(
      `Invalid DAILY_QUESTION_CRON "${config.dailyQuestionCron}", daily questions disabled`
    );
    return;
  }

  cron.schedule(
    config.dailyQuestionCron,
    async () => {
      const couples = listCouples();
      console.log(`Sending daily questions to ${couples.length} couple(s)`);
      for (const couple of couples) {
        try {
          await sendQuestionToCouple(client, couple);
        } catch (error) {
          console.error(`Daily question failed for couple ${couple.id}:`, error);
        }
      }

      try {
        await sendThrowbacks(client);
      } catch (error) {
        console.error("Throwbacks failed:", error);
      }
    },
    { timezone: config.dailyQuestionTimezone }
  );

  console.log(
    `Daily questions scheduled: ${config.dailyQuestionCron} (${config.dailyQuestionTimezone})`
  );
}

async function sendThrowbacks(client) {
  const { year, month, day, iso } = getTodayInZone(config.dailyQuestionTimezone);
  const monthDay = `${month}-${day}`;
  const rows = memoriesOnThisDay(monthDay, year, iso);
  for (const memory of rows) {
    const couple = getCoupleById(memory.couple_id);
    if (!couple) continue;
    const years = yearsAgo(memory.happened_on, year);
    await sendToCouple(client, couple, {
      embeds: [memoryEmbed(memory, { throwback: true, years })],
    });
    markThrowbackSent(memory.id, year);
  }
}
