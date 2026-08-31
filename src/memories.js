import { getDb, now } from "./db.js";
import { todayParts } from "./notify.js";
import { colors, embed, formatWhen, truncate } from "./ui.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseMemoryDate(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

export function saveMemory({ coupleId, caption, photoUrl, happenedOn, userId }) {
  const result = getDb()
    .prepare(
      `INSERT INTO memories
        (couple_id, caption, photo_url, happened_on, added_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(coupleId, caption.trim(), photoUrl || null, happenedOn, userId, now());
  return getMemory(result.lastInsertRowid);
}

export function getMemory(id) {
  return getDb().prepare(`SELECT * FROM memories WHERE id = ?`).get(id);
}

export function randomMemory(coupleId) {
  return getDb()
    .prepare(
      `SELECT * FROM memories WHERE couple_id = ? ORDER BY RANDOM() LIMIT 1`
    )
    .get(coupleId);
}

export function listMemories(coupleId, limit = 10) {
  return getDb()
    .prepare(
      `SELECT * FROM memories
       WHERE couple_id = ?
       ORDER BY happened_on DESC, created_at DESC
       LIMIT ?`
    )
    .all(coupleId, limit);
}

export function countMemories(coupleId) {
  return getDb()
    .prepare(`SELECT COUNT(*) AS n FROM memories WHERE couple_id = ?`)
    .get(coupleId).n;
}

export function memoriesOnThisDay(monthDay, year, isoToday) {
  const rows = getDb()
    .prepare(
      `SELECT * FROM memories
       WHERE substr(happened_on, 6, 5) = ?
         AND happened_on < ?
         AND (last_throwback_year IS NULL OR last_throwback_year < ?)`
    )
    .all(monthDay, isoToday, Number(year));

  if (monthDay === "03-01") {
    const leap = getDb()
      .prepare(
        `SELECT * FROM memories
         WHERE substr(happened_on, 6, 5) = '02-29'
           AND happened_on < ?
           AND (last_throwback_year IS NULL OR last_throwback_year < ?)`
      )
      .all(isoToday, Number(year));
    const leapYear = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    if (!leapYear(Number(year))) {
      rows.push(...leap);
    }
  }

  return rows;
}

export function markThrowbackSent(memoryId, year) {
  getDb()
    .prepare(`UPDATE memories SET last_throwback_year = ? WHERE id = ?`)
    .run(Number(year), memoryId);
}

export function yearsAgo(happenedOn, currentYear) {
  return Number(currentYear) - Number(happenedOn.slice(0, 4));
}

export function getTodayInZone(timeZone) {
  return todayParts(timeZone);
}

export function memoryEmbed(memory, { throwback = false, years } = {}) {
  const title = throwback
    ? `On this day · ${years} year${years === 1 ? "" : "s"} ago`
    : "A memory";
  const result = embed({
    color: throwback ? colors.gold : colors.sea,
    title,
    description: memory.caption,
    footer: `Happened ${formatWhen(memory.happened_on)}`,
  });
  if (memory.photo_url) {
    result.setImage(memory.photo_url);
  }
  return result;
}

export function memoryListEmbed(memories) {
  if (!memories.length) {
    return embed({
      color: colors.sea,
      title: "Time capsule",
      description:
        "No memories yet. Save one with `/memory save` — a photo and a caption is enough.",
    });
  }

  const result = embed({
    color: colors.sea,
    title: "Time capsule",
    description: "Recent moments you asked the bot to keep.",
    footer: `${memories.length} shown · /memory random to relive one`,
  });

  for (const memory of memories) {
    result.addFields({
      name: formatWhen(memory.happened_on),
      value: truncate(memory.caption, 300),
      inline: false,
    });
  }

  return result;
}
