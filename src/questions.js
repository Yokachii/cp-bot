import { getDb, now } from "./db.js";
import { getPartnerId } from "./couples.js";

export function getPendingRound(coupleId) {
  return getDb()
    .prepare(
      `SELECT * FROM question_rounds
       WHERE couple_id = ? AND completed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(coupleId);
}

export function getRoundById(roundId) {
  return getDb()
    .prepare(`SELECT * FROM question_rounds WHERE id = ?`)
    .get(roundId);
}

export function countCompletedRounds(coupleId) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM question_rounds
       WHERE couple_id = ? AND completed_at IS NOT NULL`
    )
    .get(coupleId).n;
}

export function getQuestion(questionId) {
  return getDb()
    .prepare(`SELECT * FROM questions WHERE id = ?`)
    .get(questionId);
}

export function isQuestionCategory(category) {
  return Boolean(
    getDb().prepare(`SELECT 1 FROM questions WHERE category = ? LIMIT 1`).get(category)
  );
}

export function listQuestionCategories() {
  return getDb()
    .prepare(
      `SELECT category, COUNT(*) AS n FROM questions GROUP BY category ORDER BY category`
    )
    .all();
}

function poolFilter(category) {
  return category
    ? { sql: `q.category = ?`, params: [category] }
    : { sql: `1 = 1`, params: [] };
}

export function questionPoolStats(coupleId, category) {
  const { sql, params } = poolFilter(category);
  const total = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM questions q WHERE ${sql}`)
    .get(...params).n;
  const remaining = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM questions q
       WHERE ${sql}
         AND q.id NOT IN (
           SELECT question_id FROM question_seen WHERE couple_id = ?
         )`
    )
    .get(...params, coupleId).n;
  return { total, remaining, seen: total - remaining };
}

function markQuestionSeen(coupleId, questionId) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO question_seen (couple_id, question_id, drawn_at)
       VALUES (?, ?, ?)`
    )
    .run(coupleId, questionId, now());
}

function lastSeenInPool(coupleId, category) {
  const { sql, params } = poolFilter(category);
  const row = getDb()
    .prepare(
      `SELECT q.id FROM question_seen s
       JOIN questions q ON q.id = s.question_id
       WHERE s.couple_id = ? AND ${sql}
       ORDER BY s.drawn_at DESC
       LIMIT 1`
    )
    .get(coupleId, ...params);
  return row?.id ?? null;
}

function resetPool(coupleId, category) {
  if (category) {
    getDb()
      .prepare(
        `DELETE FROM question_seen
         WHERE couple_id = ?
           AND question_id IN (SELECT id FROM questions WHERE category = ?)`
      )
      .run(coupleId, category);
    return;
  }
  getDb().prepare(`DELETE FROM question_seen WHERE couple_id = ?`).run(coupleId);
}

export function pickRandomQuestion(coupleId, category) {
  const { sql, params } = poolFilter(category);

  const unused = getDb()
    .prepare(
      `SELECT q.* FROM questions q
       WHERE ${sql}
         AND q.id NOT IN (
           SELECT question_id FROM question_seen WHERE couple_id = ?
         )
       ORDER BY RANDOM()
       LIMIT 1`
    )
    .get(...params, coupleId);

  if (unused) return unused;

  const lastId = lastSeenInPool(coupleId, category);
  resetPool(coupleId, category);

  const next = getDb()
    .prepare(
      `SELECT q.* FROM questions q
       WHERE ${sql} AND q.id != ?
       ORDER BY RANDOM()
       LIMIT 1`
    )
    .get(...params, lastId ?? -1);

  return (
    next ||
    getDb()
      .prepare(`SELECT q.* FROM questions q WHERE ${sql} ORDER BY RANDOM() LIMIT 1`)
      .get(...params)
  );
}

export function startRound(coupleId, category) {
  const pending = getPendingRound(coupleId);
  if (pending) {
    return { alreadyPending: true, round: pending, question: getQuestion(pending.question_id) };
  }

  const question = pickRandomQuestion(coupleId, category);
  if (!question) {
    throw new Error("No questions are seeded in the database.");
  }

  markQuestionSeen(coupleId, question.id);

  const result = getDb()
    .prepare(
      `INSERT INTO question_rounds (couple_id, question_id, created_at)
       VALUES (?, ?, ?)`
    )
    .run(coupleId, question.id, now());

  return {
    alreadyPending: false,
    round: getRoundById(result.lastInsertRowid),
    question,
  };
}

export function startRoundWithQuestion(coupleId, questionId) {
  const pending = getPendingRound(coupleId);
  if (pending) {
    return { alreadyPending: true, round: pending, question: getQuestion(pending.question_id) };
  }

  const question = getQuestion(questionId);
  if (!question) {
    throw new Error("Question not found.");
  }

  markQuestionSeen(coupleId, question.id);

  const result = getDb()
    .prepare(
      `INSERT INTO question_rounds (couple_id, question_id, created_at)
       VALUES (?, ?, ?)`
    )
    .run(coupleId, question.id, now());

  return {
    alreadyPending: false,
    round: getRoundById(result.lastInsertRowid),
    question,
  };
}

export function getAnswers(roundId) {
  return getDb()
    .prepare(`SELECT * FROM answers WHERE round_id = ?`)
    .all(roundId);
}

export function getAnswer(roundId, userId) {
  return getDb()
    .prepare(`SELECT * FROM answers WHERE round_id = ? AND user_id = ?`)
    .get(roundId, userId);
}

export function submitAnswer(roundId, userId, answer, couple) {
  const existing = getAnswer(roundId, userId);
  if (existing) {
    return { alreadyAnswered: true, complete: false, answers: getAnswers(roundId) };
  }

  getDb()
    .prepare(
      `INSERT INTO answers (round_id, user_id, answer, submitted_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(roundId, userId, answer.trim(), now());

  const answers = getAnswers(roundId);
  const bothDone = couple.members.every((id) =>
    answers.some((row) => row.user_id === id)
  );

  if (bothDone) {
    getDb()
      .prepare(`UPDATE question_rounds SET completed_at = ? WHERE id = ?`)
      .run(now(), roundId);
  }

  return { alreadyAnswered: false, complete: bothDone, answers };
}

export function formatReveal(question, couple, answers) {
  const lines = couple.members.map((userId) => {
    const row = answers.find((item) => item.user_id === userId);
    return `**<@${userId}>**\n${row?.answer ?? "—"}`;
  });

  return {
    title: "Both answers are in",
    description: `**${question.prompt}**\n\n${lines.join("\n\n")}`,
    category: question.category,
  };
}

export { getPartnerId };
