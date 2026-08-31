import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { config } from "./config.js";
import {
  addHabit,
  createCouple,
  createInvite,
  deleteCouple,
  deleteInvite,
  getCoupleById,
  getCoupleByUserId,
  getHabitByName,
  getHabitById,
  getInvite,
  listHabits,
  listPartnerHabits,
  logHabit,
  recentHabitLogs,
  countLogsToday,
  setCoupleChannels,
  updateCoupleData,
} from "./couples.js";
import {
  countCompletedRounds,
  formatReveal,
  getAnswer,
  getPendingRound,
  getQuestion,
  getRoundById,
  isQuestionCategory,
  listQuestionCategories,
  questionPoolStats,
  startRound,
  pickRandomQuestion,
  startRoundWithQuestion,
  submitAnswer,
} from "./questions.js";
import {
  countCompletedQuizzes,
  getPendingQuiz,
  getQuizItem,
  getQuizRound,
  listAllQuizSets,
  listQuizPacks,
  listQuizPacksWithProgress,
  listQuizSets,
  nextQuizStep,
  saveGuessAnswer,
  saveSelfAnswer,
  startQuiz,
  userFinishedQuiz,
  getPartnerId,
} from "./quizzes.js";
import { maybeSendQuizRecap, sendCurrentQuizStep } from "./quizUi.js";
import {
  addBucketItem,
  bucketListPayload,
  completeBucketItem,
  ensureBucketlistMessage,
  getBucketItem,
  getBucketItemByDisplayId,
  listBucketItems,
  listBucketItemsNumbered,
  removeBucketItem,
  resendBucketlistMessage,
} from "./bucketlist.js";
import {
  clearMood,
  DEFAULT_MOOD_EMOJI,
  findPreset,
  getMood,
  MOOD_PRESETS,
  moodEmbed,
  normalizeMoodEmoji,
  setMood,
} from "./moods.js";
import {
  countMemories,
  getTodayInZone,
  listMemories,
  memoryEmbed,
  memoryListEmbed,
  parseMemoryDate,
  randomMemory,
  saveMemory,
} from "./memories.js";
import { dmUser, sendToCouple } from "./notify.js";
import {
  colors,
  durationBetween,
  embed,
  formatWhen,
  progressBar,
  truncate,
} from "./ui.js";
import { getDb } from "./db.js";

const ephemeral = { flags: MessageFlags.Ephemeral };

export async function handleInteraction(interaction) {
  try {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      return;
    }
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }
    if (interaction.isStringSelectMenu()) {
      await handleSelect(interaction);
      return;
    }
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (error) {
    console.error(error);
    const message = "Something went wrong. Try again in a moment.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ...ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content: message, ...ephemeral }).catch(() => {});
    }
  }
}

async function handleCommand(interaction) {
  const name = interaction.commandName;
  if (name === "couple") {
    await handleCouple(interaction);
    return;
  }
  if (name === "question") {
    await handleQuestionCommand(interaction);
    return;
  }
  if (name === "decks") {
    await handleDecks(interaction);
    return;
  }
  if (name === "quiz") {
    await handleQuizCommand(interaction);
    return;
  }
  if (name === "bucketlist") {
    await handleBucketlistCommand(interaction);
    return;
  }
  if (name === "memory") {
    await handleMemoryCommand(interaction);
    return;
  }
  if (name === "habit") {
    await handleHabit(interaction);
    return;
  }
  if (name === "mood") {
    await handleMood(interaction);
    return;
  }
  if (name === "help") {
    await handleHelp(interaction);
  }
}

async function handleHelp(interaction) {
  const card = embed({
    color: colors.blush,
    title: "Couple bot · all commands",
    description:
      "Pair first with `/couple pair @user` — after that, everything below works for the two of you.",
  });

  card.addFields(
    {
      name: "Getting started — /couple",
      value: [
        "`/couple pair @user` — invite someone to be your partner",
        "`/couple leave` — unlink your couple profile",
        "`/couple channels [questions] [quizzes] [bucketlist] [habits]` — choose where each feature posts (empty = view)",
        "`/couple set [name] [since] [my_birthday] [partner_birthday]` — personalize your couple card",
        "`/couple info` — names, time together, birthdays, stats, habits, channels",
      ].join("\n"),
    },
    {
      name: "Questions — /question & /decks",
      value: [
        "`/question [category]` — draw a question for you two",
        "You both answer in DMs; nothing is revealed until you have both replied.",
        "The optional `category` picks a deck (love maps, repair, fun, …).",
        "`/decks [category]` — how many fresh questions are left in each deck",
      ].join("\n"),
    },
    {
      name: "Quizzes — /quiz",
      value: [
        "`/quiz start [pack] [quiz]` — 5-question guess-your-partner quiz",
        "`/quiz packs` — list packs and how many quizzes you have left",
        "Answer for yourself first, then guess what your partner picked.",
      ].join("\n"),
    },
    {
      name: "Bucket list — /bucketlist",
      value: [
        "`/bucketlist add <idea> [description] [emoji]` — add an objective with its own emoji and details",
        "`/bucketlist complete goal:<#number>` — check an objective off by its list number",
        "`/bucketlist remove goal:<#number>` — delete an objective",
        "`/bucketlist list` — show the checklist (every line starts with its #number)",
        "`/bucketlist resend` — re-post the permanent list message if it was deleted",
        "Built for huge lists — one live channel message, always edited in place.",
      ].join("\n"),
    },
    {
      name: "Memories — /memory",
      value: [
        "`/memory save <caption> [photo_url] [photo] [when]` — save a moment",
        "`/memory random` — relive a random memory",
        "`/memory list` — recent memories",
        "`when` takes `YYYY-MM-DD`. Anniversaries get an automatic throwback.",
      ].join("\n"),
    },
    {
      name: "Habits — /habit",
      value: [
        "`/habit add <name> [goal_per_day]` — create a daily habit for yourself",
        "`/habit log <name> [note]` — log that you did it",
        "`/habit list` — your habits with streaks",
        "`/habit view-partner` — see your partner's habits and progress",
      ].join("\n"),
    },
    {
      name: "Moods — /mood",
      value: [
        "`/mood set mood:<preset or your own> [emoji] [description]` — share how you feel; your partner gets a DM",
        "`/mood view` — see both of your current moods",
        "`/mood clear` — clear your mood",
        "Presets carry their own emoji (happy, sad, sleepy…); custom moods can use any emoji.",
      ].join("\n"),
    }
  );

  await interaction.reply({ embeds: [card], ...ephemeral });
}

async function requireCouple(interaction) {
  const couple = getCoupleByUserId(interaction.user.id);
  if (!couple) {
    await interaction.reply({
      embeds: [
        embed({
          color: colors.rose,
          title: "You are not paired yet",
          description: "Invite your person with `/couple pair`, then they accept.",
        }),
      ],
      ...ephemeral,
    });
    return null;
  }
  return couple;
}

async function handleCouple(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "pair") {
    const target = interaction.options.getUser("user", true);
    if (target.bot) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "That will not work",
            description: "You cannot pair with a bot.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    if (target.id === interaction.user.id) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Need two people",
            description: "Invite your partner, not yourself.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    if (getCoupleByUserId(interaction.user.id)) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Already paired",
            description: "Use `/couple leave` first if you want to start over.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    if (getCoupleByUserId(target.id)) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "They are already paired",
            description: "That person already has a couple profile on this bot.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    const inviteId = createInvite(
      interaction.user.id,
      target.id,
      interaction.guildId
    );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`invite_accept:${inviteId}`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`invite_decline:${inviteId}`)
        .setLabel("Not now")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `${target}`,
      embeds: [
        embed({
          color: colors.blush,
          title: "Couple invite",
          description: `${interaction.user} would like to pair with you in this bot.\n\nQuestions, quizzes, a bucket list, and memories stay between the two of you.`,
          footer: "Only the invited person can accept.",
        }),
      ],
      components: [row],
    });
    return;
  }

  if (sub === "leave") {
    const couple = await requireCouple(interaction);
    if (!couple) return;
    deleteCouple(couple.id);
    await interaction.reply({
      embeds: [
        embed({
          color: colors.ink,
          title: "Unlinked",
          description: "Your couple profile is gone. You can pair again anytime.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  if (sub === "channels") {
    const couple = await requireCouple(interaction);
    if (!couple) return;
    const picks = [
      { option: "questions", column: "channel_id", label: "Questions" },
      { option: "quizzes", column: "quiz_channel_id", label: "Quizzes" },
      { option: "bucketlist", column: "bucketlist_channel_id", label: "Bucket list" },
      { option: "habits", column: "habit_channel_id", label: "Habits" },
    ];

    const updates = {};
    const chosen = [];
    for (const pick of picks) {
      const picked = interaction.options.getChannel(pick.option);
      if (!picked) continue;
      if (picked.type !== ChannelType.GuildText) {
        await interaction.reply({
          embeds: [
            embed({
              color: colors.rose,
              title: "Pick text channels",
              description: `${picked} is not a regular text channel.`,
            }),
          ],
          ...ephemeral,
        });
        return;
      }
      updates[pick.column] = picked.id;
      chosen.push({ ...pick, channel: picked });
    }

    if (!chosen.length) {
      const card = embed({
        color: colors.blush,
        title: "Your channels",
        description: "Where each feature posts. Set them with `/couple channels`.",
      });
      card.addFields(
        {
          name: "Questions",
          value: couple.channel_id ? `<#${couple.channel_id}>` : "DMs only",
          inline: true,
        },
        {
          name: "Quizzes",
          value: couple.quiz_channel_id ? `<#${couple.quiz_channel_id}>` : "Not set",
          inline: true,
        },
        {
          name: "Bucket list",
          value: couple.bucketlist_channel_id
            ? `<#${couple.bucketlist_channel_id}>`
            : "Not set",
          inline: true,
        },
        {
          name: "Habits",
          value: couple.habit_channel_id ? `<#${couple.habit_channel_id}>` : "Not set",
          inline: true,
        }
      );
      await interaction.reply({ embeds: [card], ...ephemeral });
      return;
    }

    setCoupleChannels(couple.id, updates);
    await interaction.reply({
      embeds: [
        embed({
          color: colors.sage,
          title: "Channels saved",
          description: chosen
            .map((pick) => `**${pick.label}** → ${pick.channel}`)
            .join("\n"),
        }),
      ],
      ...ephemeral,
    });

    for (const pick of chosen) {
      if (pick.column === "bucketlist_channel_id") continue; // the permanent message covers it
      try {
        const target = await interaction.client.channels.fetch(pick.channel.id);
        if (target?.isTextBased()) {
          await target.send({
            embeds: [
              embed({
                color: colors.sage,
                title: `${pick.label} channel linked`,
                description: `${pick.label} updates for this couple will land here.`,
              }),
            ],
          });
        }
      } catch (error) {
        console.error(`Could not announce in ${pick.label} channel:`, error.message);
      }
    }

    if (updates.bucketlist_channel_id) {
      await ensureBucketlistMessage(interaction.client, getCoupleById(couple.id));
    }
    return;
  }

  if (sub === "set") {
    const couple = await requireCouple(interaction);
    if (!couple) return;
    const name = interaction.options.getString("name");
    const since = interaction.options.getString("since");
    const myBirthday = interaction.options.getString("my_birthday");
    const partnerBirthday = interaction.options.getString("partner_birthday");

    if (!name && !since && !myBirthday && !partnerBirthday) {
      const profile = couple.data || {};
      const partnerId = getPartnerId(couple, interaction.user.id);
      const card = embed({
        color: colors.blush,
        title: "Couple profile",
        description: [
          `Name: ${profile.name || "not set"}`,
          `Together since: ${profile.since ? formatWhen(profile.since) : "not set"}`,
          `Your birthday: ${
            profile.birthdays?.[interaction.user.id]
              ? formatWhen(profile.birthdays[interaction.user.id])
              : "not set"
          }`,
          `Partner's birthday: ${
            profile.birthdays?.[partnerId]
              ? formatWhen(profile.birthdays[partnerId])
              : "not set"
          }`,
          "",
          "Set them with `/couple set name:… since:YYYY-MM-DD my_birthday:YYYY-MM-DD partner_birthday:YYYY-MM-DD`.",
        ].join("\n"),
      });
      await interaction.reply({ embeds: [card], ...ephemeral });
      return;
    }

    for (const [label, value] of [
      ["since", since],
      ["my_birthday", myBirthday],
      ["partner_birthday", partnerBirthday],
    ]) {
      if (value && !parseMemoryDate(value)) {
        await interaction.reply({
          embeds: [
            embed({
              color: colors.rose,
              title: "Date looks off",
              description: `\`${label}\` must be \`YYYY-MM-DD\`, for example \`2024-08-30\`.`,
            }),
          ],
          ...ephemeral,
        });
        return;
      }
    }

    const patch = {};
    const setLines = [];
    if (name) {
      patch.name = name.trim();
      setLines.push(`Name → **${name.trim()}**`);
    }
    if (since) {
      patch.since = since;
      setLines.push(`Together since → ${formatWhen(since)}`);
    }
    if (myBirthday || partnerBirthday) {
      const partnerId = getPartnerId(couple, interaction.user.id);
      const birthdays = { ...(couple.data?.birthdays || {}) };
      if (myBirthday) {
        birthdays[interaction.user.id] = myBirthday;
        setLines.push(`Your birthday → ${formatWhen(myBirthday)}`);
      }
      if (partnerBirthday) {
        birthdays[partnerId] = partnerBirthday;
        setLines.push(`Partner's birthday → ${formatWhen(partnerBirthday)}`);
      }
      patch.birthdays = birthdays;
    }

    updateCoupleData(couple.id, patch);
    await interaction.reply({
      embeds: [
        embed({
          color: colors.sage,
          title: "Profile updated",
          description: setLines.join("\n"),
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  if (sub === "info") {
    const couple = await requireCouple(interaction);
    if (!couple) return;
    const pending = getPendingRound(couple.id);
    const pendingQuiz = getPendingQuiz(couple.id);
    const myHabits = listHabits(couple.id, interaction.user.id);
    const partnerHabits = listPartnerHabits(couple.id, getPartnerId(couple, interaction.user.id));
    const bucket = listBucketItems(couple.id);
    const done = bucket.filter((item) => item.completed_at).length;
    const memories = countMemories(couple.id);
    const question = pending ? getQuestion(pending.question_id) : null;
    const questionsAnswered = countCompletedRounds(couple.id);
    const quizzesCompleted = countCompletedQuizzes(couple.id);
    const profile = couple.data || {};
    const today = getTodayInZone(config.dailyQuestionTimezone).iso;

    const users = await Promise.all(
      couple.members.map((id) =>
        interaction.client.users.fetch(id).catch(() => null)
      )
    );
    const memberLines = couple.members.map((id, index) => {
      const user = users[index];
      return user ? `<@${id}> · @${user.username}` : `<@${id}>`;
    });

    const card = embed({
      color: colors.blush,
      title: profile.name || "Your couple",
      description: memberLines.join("\n"),
      footer: "couple bot",
    });

    const habitDisplay = (habits) => {
      if (!habits.length) return "None yet";
      return habits
        .map((h) => `**${h.name}** — 🔥 ${h.current_streak || 0} day streak`)
        .join("\n");
    };

    const fields = [];

    if (profile.since) {
      const duration = durationBetween(profile.since, today);
      fields.push({
        name: "Together",
        value: `Since ${formatWhen(profile.since)}${
          duration ? `\n❤️ ${duration}` : ""
        }`,
        inline: true,
      });
    }

    const birthdayLines = couple.members
      .map((id) => {
        const birthday = profile.birthdays?.[id];
        return birthday ? `<@${id}> — ${formatWhen(birthday)}` : null;
      })
      .filter(Boolean);
    if (birthdayLines.length) {
      fields.push({
        name: "Birthdays",
        value: birthdayLines.join("\n"),
        inline: true,
      });
    }

    fields.push(
      {
        name: "Questions answered",
        value: `${questionsAnswered}`,
        inline: true,
      },
      {
        name: "Quizzes completed",
        value: `${quizzesCompleted}`,
        inline: true,
      },
      {
        name: "Open question",
        value: pending
          ? truncate(question?.prompt || "waiting", 180)
          : "None",
        inline: false,
      },
      {
        name: "Quiz",
        value: pendingQuiz ? "In progress in DMs" : "None in progress",
        inline: true,
      },
      {
        name: "Bucket list",
        value: bucket.length
          ? `${progressBar(done, bucket.length, 6)}  ${done}/${bucket.length}`
          : "Empty",
        inline: true,
      },
      {
        name: "Memories",
        value: memories ? `${memories} saved` : "None yet",
        inline: true,
      },
      {
        name: "Your habits",
        value: habitDisplay(myHabits),
        inline: false,
      },
      {
        name: "Partner's habits",
        value: habitDisplay(partnerHabits),
        inline: false,
      },
      {
        name: "Channels",
        value: [
          `Questions: ${couple.channel_id ? `<#${couple.channel_id}>` : "DMs only"}`,
          `Quizzes: ${couple.quiz_channel_id ? `<#${couple.quiz_channel_id}>` : "not set"}`,
          `Bucket list: ${couple.bucketlist_channel_id ? `<#${couple.bucketlist_channel_id}>` : "not set"}`,
          `Habits: ${couple.habit_channel_id ? `<#${couple.habit_channel_id}>` : "not set"}`,
        ].join("\n"),
        inline: false,
      }
    );

    card.addFields(...fields);
    await interaction.reply({ embeds: [card], ...ephemeral });
  }
}

async function handleQuestionCommand(interaction) {
  const couple = await requireCouple(interaction);
  if (!couple) return;
  const category = interaction.options.getString("category");
  if (category && !isQuestionCategory(category)) {
    await interaction.reply({
      embeds: [
        embed({
          color: colors.rose,
          title: "Unknown deck",
          description: "Pick a category from the autocomplete list.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const pending = getPendingRound(couple.id);
  if (pending) {
    const result = await sendQuestionToCouple(interaction.client, couple, category);
    await interaction.editReply({
      embeds: [
        embed({
          color: colors.blush,
          title: result.alreadyPending ? "Still waiting" : "Question sent",
          description: result.message,
        }),
      ],
    });
    return;
  }

  const question = pickRandomQuestion(couple.id, category);
  if (!question) {
    await interaction.editReply({
      embeds: [
        embed({
          color: colors.rose,
          title: "No questions",
          description: "No questions are seeded in that deck.",
        }),
      ],
    });
    return;
  }

  const previewEmbed = embed({
    color: colors.blush,
    title: "Preview question",
    description: `**${question.prompt}**\n\nAccept this question or draw a new one.`,
    footer: question.category ? `Deck · ${question.category}` : "couple bot",
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`qpreview:accept:${interaction.user.id}:${question.id}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`qpreview:new:${interaction.user.id}:${category ? encodeURIComponent(category) : ""}`)
      .setLabel("Draw new")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [previewEmbed], components: [row] });
}

async function handleDecks(interaction) {
  const couple = await requireCouple(interaction);
  if (!couple) return;
  const category = interaction.options.getString("category");

  if (category) {
    if (!isQuestionCategory(category)) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Unknown deck",
            description: "Pick a deck from the autocomplete list.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    const stats = questionPoolStats(couple.id, category);
    const card = embed({
      color: colors.blush,
      title: `Deck · ${category}`,
      description: `${progressBar(stats.remaining, stats.total)}  **${stats.remaining}/${stats.total}** left`,
      footer:
        stats.remaining === 0
          ? "All seen — I will reshuffle this deck on the next draw"
          : "Fresh questions are drawn before any repeats",
    });
    card.addFields(
      { name: "Total", value: String(stats.total), inline: true },
      { name: "Not yet drawn", value: String(stats.remaining), inline: true },
      { name: "Already drawn", value: String(stats.seen), inline: true }
    );
    await interaction.reply({ embeds: [card], ...ephemeral });
    return;
  }

  const decks = listQuestionCategories();
  if (!decks.length) {
    await interaction.reply({
      embeds: [
        embed({
          color: colors.rose,
          title: "No decks",
          description: "No questions are seeded yet.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  const lines = decks.map((deck) => {
    const stats = questionPoolStats(couple.id, deck.category);
    return `${progressBar(stats.remaining, stats.total, 6)}  **${deck.category}** — ${stats.remaining}/${stats.total} left`;
  });
  const totalAll = decks.reduce((sum, deck) => sum + deck.n, 0);
  const remainingAll = decks.reduce(
    (sum, deck) => sum + questionPoolStats(couple.id, deck.category).remaining,
    0
  );

  const card = embed({
    color: colors.blush,
    title: "Question decks",
    description: [
      `**${remainingAll}/${totalAll}** fresh questions left across ${decks.length} decks.`,
      "",
      ...lines,
    ].join("\n"),
    footer: "Draw with /question · decks reshuffle when exhausted",
  });
  await interaction.reply({ embeds: [card], ...ephemeral });
}

export async function sendQuestionToCouple(client, couple, category) {
  const started = startRound(couple.id, category);
  const { round, question } = started;

  if (started.alreadyPending) {
    await notifyPartners(client, couple, round, question, true);
    return {
      alreadyPending: true,
      message:
        "You already have an unanswered question. I sent it again to both of you in DMs.",
    };
  }

  await notifyPartners(client, couple, round, question, false);
  return {
    alreadyPending: false,
    message: category
      ? `A **${category}** question is in both of your DMs.`
      : "A question is in both of your DMs. Answers stay hidden until you have both replied.",
  };
}

function questionEmbed(question) {
  return embed({
    color: colors.blush,
    title: "A question for you two",
    description: `**${question.prompt}**\n\nAnswer privately. Nothing is shown until both of you have replied.`,
    footer: question.category ? `Deck · ${question.category}` : "couple bot",
  });
}

function answerButton(roundId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`answer:${roundId}`)
      .setLabel("Answer privately")
      .setStyle(ButtonStyle.Primary)
  );
}

async function notifyPartners(client, couple, round, question, alreadyPending) {
  for (const userId of couple.members) {
    const already = getAnswer(round.id, userId);
    const content = already
      ? "You already answered. Waiting for your partner."
      : alreadyPending
        ? "This one is still open."
        : "Take a quiet moment with this.";
    try {
      const user = await client.users.fetch(userId);
      await user.send({
        content,
        embeds: [questionEmbed(question)],
        components: already ? [] : [answerButton(round.id)],
      });
    } catch (error) {
      console.error(`Could not DM ${userId}:`, error.message);
    }
  }
}

async function handleQuizCommand(interaction) {
  const couple = await requireCouple(interaction);
  if (!couple) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "packs") {
    const couple = await requireCouple(interaction);
    if (!couple) return;
    
    const packs = listQuizPacksWithProgress(couple.id);
    const card = embed({
      color: colors.lilac,
      title: "Quiz packs",
      description: packs.length
        ? "Five questions each. You answer for yourself, then guess theirs."
        : "No packs are seeded yet.",
    });
    for (const pack of packs) {
      const unused = `${pack.unused} unused`;
      const progress = pack.quiz_count > 0 ? ` (${pack.completed}/${pack.quiz_count} done)` : "";
      card.addFields({
        name: pack.title,
        value: `${truncate(pack.description || "Guess-your-partner quiz", 150)}\n**${unused}**${progress}\n\`${pack.slug}\``,
      });
    }
    await interaction.reply({ embeds: [card], ...ephemeral });
    return;
  }

  const slug = interaction.options.getString("pack");
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let started;
  try {
    started = startQuiz(couple.id, slug || undefined);
  } catch (error) {
    await interaction.editReply({
      embeds: [
        embed({
          color: colors.rose,
          title: "Could not start the quiz",
          description: error.message,
        }),
      ],
    });
    return;
  }

  for (const userId of couple.members) {
    await sendCurrentQuizStep(interaction.client, couple, started.round, userId);
  }

  await interaction.editReply({
    embeds: [
      embed({
        color: colors.lilac,
        title: started.alreadyPending ? "Quiz already open" : started.pack.title,
        description: started.alreadyPending
          ? "You already have a quiz in progress. I sent the next step to both of you in DMs."
          : `${started.pack.description}\n\nCheck your DMs — answer for yourself, then guess your partner.`,
      }),
    ],
  });
}

async function handleBucketlistCommand(interaction) {
  const couple = await requireCouple(interaction);
  if (!couple) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const idea = interaction.options.getString("idea", true);
    const emoji = interaction.options.getString("emoji");
    const description = interaction.options.getString("description");
    addBucketItem(couple.id, idea, interaction.user.id, { emoji, description });
    const payload = bucketListPayload(listBucketItemsNumbered(couple.id));
    await interaction.reply({
      embeds: [
        embed({
          color: colors.gold,
          title: "Added to the list",
          description: `**${idea.trim()}**\n\nI also refreshed the checklist below.`,
        }),
        ...payload.embeds,
      ],
      components: payload.components,
      ...ephemeral,
    });
    await dmUser(interaction.client, getPartnerId(couple, interaction.user.id), {
      embeds: [
        embed({
          color: colors.gold,
          title: "New bucket-list idea",
          description: `<@${interaction.user.id}> added **${idea.trim()}**.`,
        }),
      ],
    });
    await ensureBucketlistMessage(interaction.client, couple);
    return;
  }

  if (sub === "complete") {
    const goal = interaction.options.getInteger("goal", true);
    const item = getBucketItemByDisplayId(couple.id, goal);
    if (!item) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "No objective with that number",
            description:
              "Check `/bucketlist list` — every line starts with its `#number`.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    await finishBucketItem(interaction, couple, item.id);
    return;
  }

  if (sub === "remove") {
    const goal = interaction.options.getInteger("goal", true);
    const item = getBucketItemByDisplayId(couple.id, goal);
    if (!item) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "No objective with that number",
            description:
              "Check `/bucketlist list` — every line starts with its `#number`.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    const result = removeBucketItem(couple.id, item.id);
    if (!result.ok) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Nothing to remove",
            description: "That objective is no longer on the list.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    await interaction.reply({
      embeds: [
        embed({
          color: colors.ink,
          title: "Removed from the list",
          description: `**${result.item.idea}** is gone.`,
        }),
      ],
      ...ephemeral,
    });
    await dmUser(interaction.client, getPartnerId(couple, interaction.user.id), {
      embeds: [
        embed({
          color: colors.ink,
          title: "Removed from the bucket list",
          description: `<@${interaction.user.id}> removed **${result.item.idea}**.`,
        }),
      ],
    });
    await ensureBucketlistMessage(interaction.client, couple);
    return;
  }

  if (sub === "resend") {
    if (!couple.bucketlist_channel_id) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "No bucket-list channel",
            description:
              "Set one first with `/couple channels bucketlist:#channel`.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    const message = await resendBucketlistMessage(interaction.client, couple);
    await interaction.reply({
      embeds: [
        embed({
          color: colors.sage,
          title: "Checklist re-posted",
          description: message
            ? "A fresh copy of the list is live in your bucket-list channel."
            : "I could not post in the bucket-list channel. Check my permissions there.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  const payload = bucketListPayload(listBucketItemsNumbered(couple.id));
  await interaction.reply({ ...payload, ...ephemeral });
}

async function finishBucketItem(interaction, couple, itemId) {
  const result = completeBucketItem(itemId, interaction.user.id);
  if (!result.ok) {
    const description =
      result.reason === "already"
        ? "That one is already checked off."
        : "That idea is no longer on the list.";
    const payload = {
      embeds: [
        embed({
          color: colors.rose,
          title: "Nothing to complete",
          description,
        }),
      ],
      ...ephemeral,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else if (interaction.isButton()) {
      await interaction.reply(payload);
    } else {
      await interaction.reply(payload);
    }
    return;
  }

  const celebration = embed({
    color: colors.sage,
    title: "Checked off",
    description: `**${result.item.idea}**\nMarked done by <@${interaction.user.id}>.`,
  });

  if (interaction.isButton()) {
    // Stale button on an older message — refresh it in place with the current list.
    await interaction.update(bucketListPayload(listBucketItemsNumbered(couple.id)));
    await interaction.followUp({ embeds: [celebration], ...ephemeral });
  } else {
    await interaction.reply({ embeds: [celebration], ...ephemeral });
  }

  // Keep the one permanent channel message in sync (re-creates it if deleted).
  await ensureBucketlistMessage(interaction.client, couple);
}

async function handleMemoryCommand(interaction) {
  const couple = await requireCouple(interaction);
  if (!couple) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "save") {
    const caption = interaction.options.getString("caption", true);
    const photo = interaction.options.getAttachment("photo");
    const photoUrl =
      photo?.url || interaction.options.getString("photo_url") || null;
    const whenInput = interaction.options.getString("when");
    const happenedOn = whenInput
      ? parseMemoryDate(whenInput)
      : getTodayInZone(config.dailyQuestionTimezone).iso;

    if (whenInput && !happenedOn) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Date looks off",
            description: "Use `YYYY-MM-DD`, for example `2024-08-30`.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    const memory = saveMemory({
      coupleId: couple.id,
      caption,
      photoUrl,
      happenedOn,
      userId: interaction.user.id,
    });
    const card = memoryEmbed(memory);
    await interaction.reply({
      embeds: [
        embed({
          color: colors.sea,
          title: "Saved to the time capsule",
          description: "I will also send it to both of you (and your channel, if set).",
        }),
        card,
      ],
      ...ephemeral,
    });
    // await sendToCouple(interaction.client, couple, { embeds: [card] });
    return;
  }

  if (sub === "random") {
    const memory = randomMemory(couple.id);
    if (!memory) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.sea,
            title: "The capsule is empty",
            description: "Save a first memory with `/memory save`.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    const card = memoryEmbed(memory);
    card.setTitle("A random memory");
    await interaction.reply({ embeds: [card], ...ephemeral });
    return;
  }

  const memories = listMemories(couple.id, 8);
  await interaction.reply({
    embeds: [memoryListEmbed(memories)],
    ...ephemeral,
  });
}

async function handleHabit(interaction) {
  const couple = await requireCouple(interaction);
  if (!couple) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const name = interaction.options.getString("name", true);
    const goal = interaction.options.getInteger("goal_per_day") || 1;
    try {
      addHabit(couple.id, interaction.user.id, name, goal);
    } catch {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Already on your list",
            description: "You already have a habit with that name.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    await interaction.reply({
      embeds: [
        embed({
          color: colors.sage,
          title: "Habit created",
          description: `**${name.trim()}**\nGoal: ${goal}x per day\nLog it with \`/habit log\` when you do it.`,
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  if (sub === "log") {
    const name = interaction.options.getString("name", true);
    const note = interaction.options.getString("note");
    const habit = getHabitByName(couple.id, interaction.user.id, name);
    if (!habit) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "No habit with that name",
            description: "Check `/habit list`, then try again.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    
    const todayCount = countLogsToday(habit.id);
    logHabit(habit.id, note);
    
    const message = `**${habit.name}**\n${todayCount + 1}/${habit.goal_per_day} today`;
    const description = note ? `${message}\n${note}` : message;
    
    await interaction.reply({
      embeds: [
        embed({
          color: todayCount + 1 >= habit.goal_per_day ? colors.gold : colors.sage,
          title: todayCount + 1 >= habit.goal_per_day ? "Goal reached!" : "Logged",
          description,
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  if (sub === "list") {
    const habits = listHabits(couple.id, interaction.user.id);
    if (!habits.length) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.sage,
            title: "No habits yet",
            description: "Create one with `/habit add` — something small you want to keep doing daily.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    
    const habitDetails = habits.map((habit) => {
      const todayCount = countLogsToday(habit.id);
      const streak = `🔥 ${habit.current_streak || 0}`;
      const goal = `${todayCount}/${habit.goal_per_day}`;
      return `**${habit.name}** — ${streak} · ${goal} today`;
    }).join("\n");
    
    await interaction.reply({
      embeds: [
        embed({
          color: colors.sage,
          title: "Your habits",
          description: habitDetails,
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  if (sub === "view-partner") {
    const partner = getPartnerId(couple, interaction.user.id);
    const habits = listPartnerHabits(couple.id, partner);
    
    if (!habits.length) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.sea,
            title: "Their habits",
            description: "<@" + partner + "> hasn't created any habits yet.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    
    const habitDetails = habits.map((habit) => {
      const todayCount = countLogsToday(habit.id);
      const streak = `🔥 ${habit.current_streak || 0}`;
      const goal = `${todayCount}/${habit.goal_per_day}`;
      return `**${habit.name}** — ${streak} · ${goal} today`;
    }).join("\n");
    
    await interaction.reply({
      embeds: [
        embed({
          color: colors.sea,
          title: "Their habits",
          description: habitDetails,
          footer: "Keep them motivated!",
        }),
      ],
      ...ephemeral,
    });
  }
}

async function handleMood(interaction) {
  const couple = await requireCouple(interaction);
  if (!couple) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "set") {
    const moodInput = interaction.options.getString("mood", true).trim();
    const emojiInput = interaction.options.getString("emoji");
    const description = interaction.options.getString("description");

    const preset = findPreset(moodInput);
    const emoji =
      normalizeMoodEmoji(emojiInput) ||
      (preset ? preset.emoji : DEFAULT_MOOD_EMOJI);
    const title = preset ? preset.title : truncate(moodInput, 60);

    const mood = setMood(couple.id, interaction.user.id, {
      emoji,
      title,
      description: description?.trim() || null,
    });
    const card = moodEmbed(mood, interaction.user.id);

    await interaction.reply({
      embeds: [
        embed({
          color: colors.sage,
          title: "Mood shared",
          description: "Your partner has been notified. Take care of each other.",
        }),
        card,
      ],
      ...ephemeral,
    });
    await dmUser(interaction.client, getPartnerId(couple, interaction.user.id), {
      embeds: [card],
    });
    return;
  }

  if (sub === "view") {
    const lines = couple.members.map((memberId) => {
      const mood = getMood(couple.id, memberId);
      if (!mood) return `<@${memberId}> — no mood set`;
      const details = mood.description
        ? `\n> ${truncate(mood.description, 200)}`
        : "";
      return `<@${memberId}> — ${mood.emoji || DEFAULT_MOOD_EMOJI} **${mood.title}**${details}`;
    });
    await interaction.reply({
      embeds: [
        embed({
          color: colors.lilac,
          title: "Current moods",
          description: lines.join("\n\n"),
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  if (sub === "clear") {
    const existing = clearMood(couple.id, interaction.user.id);
    await interaction.reply({
      embeds: [
        embed({
          color: colors.ink,
          title: existing ? "Mood cleared" : "Nothing to clear",
          description: existing
            ? `Your **${existing.emoji || ""} ${existing.title}** mood is gone.`
            : "You had no mood set.",
        }),
      ],
      ...ephemeral,
    });
  }
}

async function handleButton(interaction) {
  if (interaction.customId.startsWith("bl:done:")) {
    const itemId = Number(interaction.customId.split(":")[2]);
    const item = getBucketItem(itemId);
    const couple = getCoupleByUserId(interaction.user.id);
    if (!item || !couple || item.couple_id !== couple.id) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Not for this couple",
            description: "That checklist item does not belong to you.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    await finishBucketItem(interaction, couple, itemId);
    return;
  }

  const [kind, id] = interaction.customId.split(":");

  if (kind === "invite_accept" || kind === "invite_decline") {
    const invite = getInvite(Number(id));
    if (!invite) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Invite expired",
            description: "Ask them to send `/couple pair` again.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }
    if (interaction.user.id !== invite.to_user_id) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "This invite is not yours",
            description: "Only the invited person can accept or decline.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    if (kind === "invite_decline") {
      deleteInvite(invite.id);
      await interaction.update({
        content: null,
        embeds: [
          embed({
            color: colors.ink,
            title: "Invite declined",
            description: "No pair was created.",
          }),
        ],
        components: [],
      });
      return;
    }

    if (getCoupleByUserId(invite.from_user_id) || getCoupleByUserId(invite.to_user_id)) {
      deleteInvite(invite.id);
      await interaction.update({
        content: null,
        embeds: [
          embed({
            color: colors.rose,
            title: "Someone is already paired",
            description: "One of you already has a couple profile.",
          }),
        ],
        components: [],
      });
      return;
    }

    createCouple(invite.from_user_id, invite.to_user_id, invite.guild_id);
    deleteInvite(invite.id);
    await interaction.update({
      content: `<@${invite.from_user_id}> <@${invite.to_user_id}>`,
      embeds: [
        embed({
          color: colors.blush,
          title: "You are paired",
          description:
            "Try `/question`, `/quiz start`, `/bucketlist add`, or `/memory save` whenever you like.",
        }),
      ],
      components: [],
    });
    return;
  }

  if (kind === "qpreview") {
    const parts = interaction.customId.split(":");
    const action = parts[1];
    const requesterId = parts[2];
    const payload = parts[3] || "";

    if (interaction.user.id !== requesterId) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Not your preview",
            description: "Only the person who asked for this preview can accept or draw a new one.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    const couple = getCoupleByUserId(requesterId);
    if (!couple) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "No couple",
            description: "Your couple profile was not found.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    if (action === "new") {
      const category = payload ? decodeURIComponent(payload) : undefined;
      const question = pickRandomQuestion(couple.id, category);
      if (!question) {
        await interaction.update({
          embeds: [
            embed({
              color: colors.rose,
              title: "No questions",
              description: "No questions are seeded in that deck.",
            }),
          ],
          components: [],
        });
        return;
      }

      const previewEmbed = embed({
        color: colors.blush,
        title: "Preview question",
        description: `**${question.prompt}**\n\nAccept this question or draw a new one.`,
        footer: question.category ? `Deck · ${question.category}` : "couple bot",
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`qpreview:accept:${requesterId}:${question.id}`)
          .setLabel("Accept")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`qpreview:new:${requesterId}:${category ? encodeURIComponent(category) : ""}`)
          .setLabel("Draw new")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.update({ embeds: [previewEmbed], components: [row] });
      return;
    }

    if (action === "accept") {
      const questionId = Number(payload);
      try {
        const started = startRoundWithQuestion(couple.id, questionId);
        if (started.alreadyPending) {
          await notifyPartners(interaction.client, couple, started.round, started.question, true);
          await interaction.update({
            embeds: [
              embed({
                color: colors.blush,
                title: "Still waiting",
                description: "You already have an unanswered question. I resent it to both of you.",
              }),
            ],
            components: [],
          });
          return;
        }

        await notifyPartners(interaction.client, couple, started.round, started.question, false);
        await interaction.update({
          embeds: [
            embed({
              color: colors.sage,
              title: "Question sent",
              description: "Accepted — the question was sent to both of you in DMs.",
            }),
          ],
          components: [],
        });
      } catch (error) {
        console.error(error);
        await interaction.update({
          embeds: [
            embed({
              color: colors.rose,
              title: "Could not start question",
              description: error.message || "Something went wrong.",
            }),
          ],
          components: [],
        });
      }
      return;
    }
  }

  if (kind === "answer") {
    const round = getRoundById(Number(id));
    if (!round || round.completed_at) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "This question is closed",
            description: "Ask for a new one with `/question`.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    const couple = getCoupleByUserId(interaction.user.id);
    if (!couple || couple.id !== round.couple_id) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.rose,
            title: "Not your question",
            description: "This round belongs to another couple.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    if (getAnswer(round.id, interaction.user.id)) {
      await interaction.reply({
        embeds: [
          embed({
            color: colors.sage,
            title: "Already answered",
            description: "Waiting for your partner now.",
          }),
        ],
        ...ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`answer_modal:${round.id}`)
      .setTitle("Your answer")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("answer_text")
            .setLabel("What do you want to say?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000)
        )
      );
    await interaction.showModal(modal);
  }
}

async function handleSelect(interaction) {
  if (!interaction.customId.startsWith("qz:")) return;

  const [, kind, roundIdRaw, itemIdRaw] = interaction.customId.split(":");
  const round = getQuizRound(Number(roundIdRaw));
  const couple = getCoupleByUserId(interaction.user.id);
  if (!round || !couple || couple.id !== round.couple_id || round.completed_at) {
    await interaction.reply({
      embeds: [
        embed({
          color: colors.rose,
          title: "This quiz is closed",
          description: "Start a new one with `/quiz start`.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  const item = getQuizItem(Number(itemIdRaw));
  const optionIndex = Number(interaction.values[0]);
  if (!item || Number.isNaN(optionIndex) || !item.options[optionIndex]) {
    await interaction.reply({
      embeds: [
        embed({
          color: colors.rose,
          title: "That option is invalid",
          description: "Try the quiz step again from `/quiz start`.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  const step = nextQuizStep(round, interaction.user.id);
  const expectedKind = kind === "g" ? "guess" : "self";
  if (step.kind === "done" || step.kind !== expectedKind || step.item.id !== item.id) {
    await interaction.update({
      embeds: [
        embed({
          color: colors.ink,
          title: "Already moved on",
          description: "This step was already saved. Check your DMs for the current one.",
        }),
      ],
      components: [],
    });
    return;
  }

  if (kind === "s") {
    saveSelfAnswer(round.id, interaction.user.id, item.id, optionIndex);
  } else {
    saveGuessAnswer(round.id, interaction.user.id, item.id, optionIndex);
  }

  const picked = item.options[optionIndex];
  await interaction.update({
    embeds: [
      embed({
        color: kind === "g" ? colors.lilac : colors.blush,
        title: "Saved",
        description: `You picked **${picked}**`,
        footer: userFinishedQuiz(round, interaction.user.id)
          ? "Waiting on your partner for the recap"
          : "Next question is on its way",
      }),
    ],
    components: [],
  });

  await sendCurrentQuizStep(interaction.client, couple, round, interaction.user.id);
  await maybeSendQuizRecap(interaction.client, couple, round);
}

async function handleModal(interaction) {
  if (!interaction.customId.startsWith("answer_modal:")) return;

  const roundId = Number(interaction.customId.split(":")[1]);
  const round = getRoundById(roundId);
  const couple = getCoupleByUserId(interaction.user.id);
  if (!round || !couple || couple.id !== round.couple_id) {
    await interaction.reply({
      embeds: [
        embed({
          color: colors.rose,
          title: "Not your question",
          description: "This round is not open for you.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  const text = interaction.fields.getTextInputValue("answer_text");
  const result = submitAnswer(roundId, interaction.user.id, text, couple);
  const question = getQuestion(round.question_id);

  if (result.alreadyAnswered) {
    await interaction.reply({
      embeds: [
        embed({
          color: colors.sage,
          title: "Already answered",
          description: "Waiting for your partner.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  if (!result.complete) {
    await interaction.reply({
      embeds: [
        embed({
          color: colors.blush,
          title: "Got it",
          description: "Your answer stays hidden until they reply too.",
        }),
      ],
      ...ephemeral,
    });
    return;
  }

  const reveal = formatReveal(question, couple, result.answers);
  const revealEmbed = embed({
    color: colors.gold,
    title: reveal.title,
    description: reveal.description,
    footer: reveal.category ? `Deck · ${reveal.category}` : "couple bot",
  });

  await interaction.reply({
    embeds: [
      embed({
        color: colors.sage,
        title: "Both of you answered",
        description: "Revealing now in DMs" + (couple.channel_id ? " and your channel." : "."),
      }),
    ],
    ...ephemeral,
  });

  await sendToCouple(interaction.client, couple, { embeds: [revealEmbed] });
}

async function handleAutocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused(true);
    const couple = getCoupleByUserId(interaction.user.id);
    let choices = [];

    if (
      (interaction.commandName === "question" ||
        interaction.commandName === "decks") &&
      focused.name === "category"
    ) {
      choices = listQuestionCategories().map((row) => ({
        name: `${row.category} (${row.n})`,
        value: row.category,
      }));
    } else if (interaction.commandName === "quiz" && focused.name === "pack") {
      choices = listQuizPacks().map((pack) => ({
        name: pack.title,
        value: pack.slug,
      }));
    } else if (interaction.commandName === "quiz" && focused.name === "quiz") {
      const packSlug = interaction.options.getString("pack");
      if (packSlug) {
        const sets = getDb()
          .prepare(
            `SELECT DISTINCT s.slug, s.title FROM quiz_sets s
             JOIN quiz_packs p ON p.id = s.pack_id
             WHERE p.slug = ?
             ORDER BY s.position, s.title`
          )
          .all(packSlug);
        choices = sets.map((set) => ({
          name: set.title,
          value: set.slug,
        }));
      } else {
        // If no pack selected yet, show all available quizzes
        const sets = getDb()
          .prepare(
            `SELECT DISTINCT s.slug, s.title, p.title as pack_title FROM quiz_sets s
             JOIN quiz_packs p ON p.id = s.pack_id
             ORDER BY p.title, s.position`
          )
          .all();
        choices = sets.map((set) => ({
          name: `${set.title} (${set.pack_title})`,
          value: set.slug,
        }));
      }
    } else if (interaction.commandName === "bucketlist" && focused.name === "goal") {
      const items = couple ? listBucketItemsNumbered(couple.id) : [];
      const pool =
        interaction.options.getSubcommand() === "complete"
          ? items.filter((item) => !item.completed_at)
          : items;
      const needle = String(focused.value ?? "").toLowerCase();
      const matches = pool
        .filter(
          (item) =>
            String(item.display_id).startsWith(needle) ||
            item.idea.toLowerCase().includes(needle)
        )
        .slice(0, 25);
      if (interaction.responded) return;
      await interaction
        .respond(
          matches.map((item) => ({
            name: `#${item.display_id}${item.completed_at ? " ✅" : ""} ${truncate(item.idea, 90)}`,
            value: item.display_id,
          }))
        )
        .catch(() => {});
      return;
    } else if (interaction.commandName === "mood" && focused.name === "mood") {
      const needle = String(focused.value ?? "").trim().toLowerCase();
      const matches = MOOD_PRESETS.filter((preset) =>
        preset.title.toLowerCase().includes(needle)
      ).slice(0, 24);
      const moodChoices = matches.map((preset) => ({
        name: `${preset.emoji} ${preset.title}`,
        value: preset.title,
      }));
      const raw = String(focused.value ?? "").trim();
      if (
        raw &&
        !matches.some((preset) => preset.title.toLowerCase() === raw.toLowerCase())
      ) {
        moodChoices.push({
          name: `✨ Use "${truncate(raw, 40)}" (custom)`,
          value: raw,
        });
      }
      if (interaction.responded) return;
      await interaction.respond(moodChoices.slice(0, 25)).catch(() => {});
      return;
    } else if (interaction.commandName === "habit" && focused.name === "name") {
      const habits = couple ? listHabits(couple.id, interaction.user.id) : [];
      choices = habits.map((habit) => ({
        name: habit.name,
        value: habit.name,
      }));
    }

    const needle = String(focused.value || "").toLowerCase();
    const filtered = choices
      .filter((choice) => choice.name.toLowerCase().includes(needle) || choice.value.toLowerCase().includes(needle))
      .slice(0, 25);

    if (interaction.responded) return;
    await interaction.respond(filtered).catch(() => {});
  } catch (error) {
    console.error("Autocomplete error:", error);
  }
}
