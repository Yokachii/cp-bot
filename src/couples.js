import { getDb, now, orderedUserIds } from "./db.js";

function parseData(row) {
  if (!row) return null;
  return {
    ...row,
    data: JSON.parse(row.data || "{}"),
    members: [row.user_a_id, row.user_b_id],
  };
}

export function getCoupleByUserId(userId) {
  const row = getDb()
    .prepare(
      `SELECT * FROM couples WHERE user_a_id = ? OR user_b_id = ?`
    )
    .get(userId, userId);
  return parseData(row);
}

export function getPartnerId(couple, userId) {
  return couple.user_a_id === userId ? couple.user_b_id : couple.user_a_id;
}

export function createInvite(fromUserId, toUserId, guildId) {
  const result = getDb()
    .prepare(
      `INSERT INTO couple_invites (from_user_id, to_user_id, guild_id, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(fromUserId, toUserId, guildId, now());
  return result.lastInsertRowid;
}

export function getInvite(inviteId) {
  return getDb().prepare(`SELECT * FROM couple_invites WHERE id = ?`).get(inviteId);
}

export function deleteInvite(inviteId) {
  getDb().prepare(`DELETE FROM couple_invites WHERE id = ?`).run(inviteId);
}

export function createCouple(userId1, userId2, guildId) {
  const [userA, userB] = orderedUserIds(userId1, userId2);
  const result = getDb()
    .prepare(
      `INSERT INTO couples (user_a_id, user_b_id, guild_id, data, created_at)
       VALUES (?, ?, ?, '{}', ?)`
    )
    .run(userA, userB, guildId, now());
  return getCoupleById(result.lastInsertRowid);
}

export function getCoupleById(id) {
  const row = getDb().prepare(`SELECT * FROM couples WHERE id = ?`).get(id);
  return parseData(row);
}

export function setCoupleChannels(coupleId, channels) {
  const allowed = [
    "channel_id",
    "quiz_channel_id",
    "bucketlist_channel_id",
    "habit_channel_id",
  ];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (channels[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(channels[key]);
    }
  }
  if (!sets.length) return;
  params.push(coupleId);
  getDb()
    .prepare(`UPDATE couples SET ${sets.join(", ")} WHERE id = ?`)
    .run(...params);
}

export function setBucketlistMessageId(coupleId, messageId) {
  getDb()
    .prepare(`UPDATE couples SET bucketlist_message_id = ? WHERE id = ?`)
    .run(messageId, coupleId);
}

export function updateCoupleData(coupleId, patch) {
  const couple = getCoupleById(coupleId);
  const data = { ...couple.data, ...patch };
  getDb()
    .prepare(`UPDATE couples SET data = ? WHERE id = ?`)
    .run(JSON.stringify(data), coupleId);
  return getCoupleById(coupleId);
}

export function deleteCouple(coupleId) {
  getDb().prepare(`DELETE FROM couples WHERE id = ?`).run(coupleId);
}

export function listCouples() {
  return getDb()
    .prepare(`SELECT * FROM couples`)
    .all()
    .map(parseData);
}

export function addHabit(coupleId, userId, name, goalPerDay = 1) {
  const result = getDb()
    .prepare(
      `INSERT INTO habits (couple_id, user_id, name, goal_per_day, created_at) VALUES (?, ?, ?, ?, ?)`
    )
    .run(coupleId, userId, name.trim(), goalPerDay, now());
  const habitId = result.lastInsertRowid;
  // Initialize streak tracking
  getDb()
    .prepare(
      `INSERT INTO habit_streaks (habit_id, current_streak, longest_streak, last_logged_date)
       VALUES (?, 0, 0, NULL)`
    )
    .run(habitId);
  return habitId;
}

export function listHabits(coupleId, userId) {
  return getDb()
    .prepare(`SELECT h.*, hs.current_streak, hs.longest_streak, hs.last_logged_date 
              FROM habits h
              LEFT JOIN habit_streaks hs ON h.id = hs.habit_id
              WHERE h.couple_id = ? AND h.user_id = ? 
              ORDER BY h.name`)
    .all(coupleId, userId);
}

export function listPartnerHabits(coupleId, partnerId) {
  return getDb()
    .prepare(`SELECT h.*, hs.current_streak, hs.longest_streak, hs.last_logged_date 
              FROM habits h
              LEFT JOIN habit_streaks hs ON h.id = hs.habit_id
              WHERE h.couple_id = ? AND h.user_id = ? 
              ORDER BY h.name`)
    .all(coupleId, partnerId);
}

export function getHabitByName(coupleId, userId, name) {
  return getDb()
    .prepare(
      `SELECT h.*, hs.current_streak, hs.longest_streak, hs.last_logged_date
       FROM habits h
       LEFT JOIN habit_streaks hs ON h.id = hs.habit_id
       WHERE h.couple_id = ? AND h.user_id = ? AND lower(h.name) = lower(?)`
    )
    .get(coupleId, userId, name.trim());
}

export function getHabitById(habitId) {
  return getDb()
    .prepare(
      `SELECT h.*, hs.current_streak, hs.longest_streak, hs.last_logged_date
       FROM habits h
       LEFT JOIN habit_streaks hs ON h.id = hs.habit_id
       WHERE h.id = ?`
    )
    .get(habitId);
}

export function logHabit(habitId, note) {
  const today = new Date().toISOString().split('T')[0];
  getDb()
    .prepare(
      `INSERT INTO habit_logs (habit_id, logged_at, note)
       VALUES (?, ?, ?)`
    )
    .run(habitId, now(), note ?? null);
  updateHabitStreak(habitId, today);
}

function updateHabitStreak(habitId, today) {
  const habit = getHabitById(habitId);
  if (!habit) return;
  
  const lastLogged = habit.last_logged_date;
  const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
  
  let currentStreak = habit.current_streak || 0;
  let longestStreak = habit.longest_streak || 0;
  
  if (lastLogged === today) {
    // Already logged today, don't increment
    return;
  } else if (lastLogged === yesterday) {
    // Continuing streak
    currentStreak += 1;
  } else {
    // Starting new streak
    currentStreak = 1;
  }
  
  longestStreak = Math.max(longestStreak, currentStreak);
  
  getDb()
    .prepare(
      `UPDATE habit_streaks SET current_streak = ?, longest_streak = ?, last_logged_date = ? WHERE habit_id = ?`
    )
    .run(currentStreak, longestStreak, today, habitId);
}

export function recentHabitLogs(habitId, limit = 10) {
  return getDb()
    .prepare(
      `SELECT * FROM habit_logs WHERE habit_id = ? ORDER BY logged_at DESC LIMIT ?`
    )
    .all(habitId, limit);
}

export function countLogsToday(habitId) {
  const today = Math.floor(Date.now() / 1000) - (Math.floor(Date.now() / 1000) % 86400);
  const tomorrow = today + 86400;
  return getDb()
    .prepare(
      `SELECT COUNT(*) as count FROM habit_logs WHERE habit_id = ? AND logged_at >= ? AND logged_at < ?`
    )
    .get(habitId, today, tomorrow).count;
}
