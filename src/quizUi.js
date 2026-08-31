import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { getPartnerId } from "./couples.js";
import { dmUser, sendToCouple } from "./notify.js";
import { colors, embed, progressBar, truncate } from "./ui.js";
import {
  bothFinishedQuiz,
  completeQuizIfReady,
  getPack,
  getSet,
  nextQuizStep,
  scoreQuiz,
} from "./quizzes.js";

export function quizStepPayload(round, couple, userId, step) {
  const partnerId = getPartnerId(couple, userId);
  const isGuess = step.kind === "guess";
  const pack = getPack(round.pack_id);
  const set = getSet(round.set_id);
  const current = step.index + 1;
  const bar = progressBar(step.index, step.total);
  const footerLabel = set?.title || pack?.title;

  const card = embed({
    color: isGuess ? colors.lilac : colors.blush,
    title: isGuess ? "Guess their answer" : "Your answer first",
    description:
      `${bar}  **${current} / ${step.total}**\n\n**${step.item.prompt}**\n\n` +
      (isGuess
        ? `What do you think <@${partnerId}> picked for themselves?`
        : "Pick what is true for **you**. They will try to guess it later."),
    footer: footerLabel
      ? `${footerLabel} · hidden until you both finish`
      : "Hidden until you both finish",
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`qz:${isGuess ? "g" : "s"}:${round.id}:${step.item.id}`)
    .setPlaceholder(isGuess ? "They would pick…" : "I would pick…")
    .addOptions(
      step.item.options.map((label, optionIndex) => ({
        label: truncate(label, 100),
        value: String(optionIndex),
        description: isGuess ? "Their likely answer" : "True for me",
      }))
    );

  return {
    embeds: [card],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}

export async function sendCurrentQuizStep(client, couple, round, userId) {
  const step = nextQuizStep(round, userId);
  if (step.kind === "done") {
    if (bothFinishedQuiz(round, couple)) return;
    await dmUser(client, userId, {
      embeds: [
        embed({
          color: colors.sage,
          title: "You are done",
          description:
            "Your answers are saved. I will send the recap as soon as your partner finishes too.",
        }),
      ],
    });
    return;
  }
  await dmUser(client, userId, quizStepPayload(round, couple, userId, step));
}

export function quizRecapPayload(round, couple) {
  const pack = getPack(round.pack_id);
  const set = getSet(round.set_id);
  const { scores, details, total } = scoreQuiz(round, couple);
  const scoreLine = couple.members
    .map((userId) => `<@${userId}> **${scores[userId]}/${total}**`)
    .join("  ·  ");

  const card = embed({
    color: colors.gold,
    title: set?.title || pack?.title || "Quiz recap",
    description: `${pack && set ? `**${pack.title}**\n` : ""}How well did you guess each other?\n\n${scoreLine}`,
    footer: "A point is for guessing what they chose for themselves.",
  });

  for (const [index, detail] of details.entries()) {
    const value = couple.members
      .map((userId) => {
        const partnerId = getPartnerId(couple, userId);
        const selfIndex = detail.byUser[userId]?.self_index;
        const selfText = detail.item.options[selfIndex] ?? "—";
        const guessIndex = detail.hits[partnerId]?.guess;
        const guessText = detail.item.options[guessIndex] ?? "—";
        const mark = detail.hits[partnerId]?.correct ? "✅" : "❌";
        return `<@${userId}>: ${selfText}\n<@${partnerId}> guessed: ${guessText} ${mark}`;
      })
      .join("\n\n");

    card.addFields({
      name: `${index + 1}. ${truncate(detail.item.prompt, 240)}`,
      value: truncate(value, 1024),
    });
  }

  return { embeds: [card] };
}

export async function maybeSendQuizRecap(client, couple, round) {
  if (!bothFinishedQuiz(round, couple)) return false;
  completeQuizIfReady(round, couple);
  const payload = quizRecapPayload(round, couple);
  await sendToCouple(client, couple, payload);
  return true;
}
