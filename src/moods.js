import { getDb, now } from "./db.js";
import { colors, embed, truncate } from "./ui.js";

export const DEFAULT_MOOD_EMOJI = "✨";

export const MOOD_PRESETS = [
  { emoji: "😊", title: "Happy" },
  { emoji: "🥰", title: "In love" },
  { emoji: "🤩", title: "Excited" },
  { emoji: "😌", title: "Calm" },
  { emoji: "🥲", title: "Touched" },
  { emoji: "😴", title: "Sleepy" },
  { emoji: "🤒", title: "Sick" },
  { emoji: "😐", title: "Meh" },
  { emoji: "😔", title: "Down" },
  { emoji: "😢", title: "Sad" },
  { emoji: "😰", title: "Anxious" },
  { emoji: "😤", title: "Frustrated" },
  { emoji: "😡", title: "Angry" },
  { emoji: "🤯", title: "Overwhelmed" },
  { emoji: "🫂", title: "Needing a hug" },
];

export function normalizeMoodEmoji(emoji) {
  const value = (emoji || "").trim();
  if (!value) return null;
  return value.slice(0, 32);
}

export function findPreset(title) {
  const needle = (title || "").trim().toLowerCase();
  return (
    MOOD_PRESETS.find((preset) => preset.title.toLowerCase() === needle) || null
  );
}

export function setMood(coupleId, userId, { emoji, title, description }) {
  getDb()
    .prepare(
      `INSERT INTO moods (couple_id, user_id, emoji, title, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(couple_id, user_id) DO UPDATE SET
         emoji = excluded.emoji,
         title = excluded.title,
         description = excluded.description,
         created_at = excluded.created_at`
    )
    .run(coupleId, userId, emoji, title.trim(), description || null, now());
  return getMood(coupleId, userId);
}

export function getMood(coupleId, userId) {
  return (
    getDb()
      .prepare(`SELECT * FROM moods WHERE couple_id = ? AND user_id = ?`)
      .get(coupleId, userId) || null
  );
}

export function clearMood(coupleId, userId) {
  const existing = getMood(coupleId, userId);
  if (existing) {
    getDb()
      .prepare(`DELETE FROM moods WHERE couple_id = ? AND user_id = ?`)
      .run(coupleId, userId);
  }
  return existing;
}

export function moodEmbed(mood, userId) {
  const lines = [
    `<@${userId}> is feeling…`,
    "",
    `${mood.emoji || DEFAULT_MOOD_EMOJI} **${truncate(mood.title, 60)}**`,
  ];
  if (mood.description) {
    lines.push("", `> ${truncate(mood.description, 400)}`);
  }
  lines.push("", `*Set <t:${Math.floor(mood.created_at / 1000)}:R>*`);
  return embed({
    color: colors.lilac,
    title: "Mood update",
    description: lines.join("\n"),
  });
}