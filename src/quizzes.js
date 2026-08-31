import { getDb, now } from "./db.js";
import { getPartnerId } from "./couples.js";

function parseItem(row) {
  if (!row) return null;
  return { ...row, options: JSON.parse(row.options_json) };
}

export function listQuizPacks() {
  return getDb()
    .prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM quiz_sets s WHERE s.pack_id = p.id) AS quiz_count
       FROM quiz_packs p
       ORDER BY p.title`
    )
    .all();
}

export function listQuizPacksWithProgress(coupleId) {
  const packs = listQuizPacks();
  return packs.map((pack) => {
    const completed = getDb()
      .prepare(
        `SELECT COUNT(DISTINCT set_id) as count FROM quiz_rounds
         WHERE couple_id = ? AND pack_id = ? AND completed_at IS NOT NULL`
      )
      .get(coupleId, pack.id);
    const unused = pack.quiz_count - (completed?.count || 0);
    return {
      ...pack,
      unused: Math.max(0, unused),
      completed: completed?.count || 0,
    };
  });
}

export function listQuizSets(packId) {
  return getDb()
    .prepare(`SELECT * FROM quiz_sets WHERE pack_id = ? ORDER BY position, title`)
    .all(packId);
}

export function listAllQuizSets() {
  return getDb()
    .prepare(
      `SELECT s.*, p.slug AS pack_slug, p.title AS pack_title
       FROM quiz_sets s
       JOIN quiz_packs p ON p.id = s.pack_id
       ORDER BY p.title, s.position`
    )
    .all();
}

export function getPackBySlug(slug) {
  return getDb().prepare(`SELECT * FROM quiz_packs WHERE slug = ?`).get(slug);
}

export function getPack(packId) {
  return getDb().prepare(`SELECT * FROM quiz_packs WHERE id = ?`).get(packId);
}

export function getSet(setId) {
  if (setId == null) return null;
  return getDb().prepare(`SELECT * FROM quiz_sets WHERE id = ?`).get(setId);
}

export function getSetBySlug(packId, slug) {
  return getDb()
    .prepare(`SELECT * FROM quiz_sets WHERE pack_id = ? AND slug = ?`)
    .get(packId, slug);
}

export function getSetItems(setId) {
  return getDb()
    .prepare(`SELECT * FROM quiz_items WHERE set_id = ? ORDER BY position`)
    .all(setId)
    .map(parseItem);
}

export function getRoundItems(round) {
  if (round.set_id) return getSetItems(round.set_id);
  return getDb()
    .prepare(`SELECT * FROM quiz_items WHERE pack_id = ? ORDER BY position`)
    .all(round.pack_id)
    .map(parseItem);
}

export function getQuizItem(itemId) {
  return parseItem(
    getDb().prepare(`SELECT * FROM quiz_items WHERE id = ?`).get(itemId)
  );
}

export function getPendingQuiz(coupleId) {
  return getDb()
    .prepare(
      `SELECT * FROM quiz_rounds
       WHERE couple_id = ? AND completed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(coupleId);
}

export function getQuizRound(roundId) {
  return getDb().prepare(`SELECT * FROM quiz_rounds WHERE id = ?`).get(roundId);
}

export function countCompletedQuizzes(coupleId) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM quiz_rounds
       WHERE couple_id = ? AND completed_at IS NOT NULL`
    )
    .get(coupleId).n;
}

function unusedSets(coupleId, packId) {
  if (packId) {
    return getDb()
      .prepare(
        `SELECT s.* FROM quiz_sets s
         WHERE s.pack_id = ?
           AND s.id NOT IN (
             SELECT set_id FROM quiz_rounds
             WHERE couple_id = ? AND completed_at IS NOT NULL AND set_id IS NOT NULL
           )
         ORDER BY RANDOM()`
      )
      .all(packId, coupleId);
  }

  return getDb()
    .prepare(
      `SELECT s.* FROM quiz_sets s
       WHERE s.id NOT IN (
         SELECT set_id FROM quiz_rounds
         WHERE couple_id = ? AND completed_at IS NOT NULL AND set_id IS NOT NULL
       )
       ORDER BY RANDOM()`
    )
    .all(coupleId);
}

function lastCompletedSetId(coupleId, packId) {
  if (packId) {
    const row = getDb()
      .prepare(
        `SELECT set_id FROM quiz_rounds
         WHERE couple_id = ? AND pack_id = ? AND completed_at IS NOT NULL AND set_id IS NOT NULL
         ORDER BY completed_at DESC
         LIMIT 1`
      )
      .get(coupleId, packId);
    return row?.set_id ?? null;
  }
  const row = getDb()
    .prepare(
      `SELECT set_id FROM quiz_rounds
       WHERE couple_id = ? AND completed_at IS NOT NULL AND set_id IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT 1`
    )
    .get(coupleId);
  return row?.set_id ?? null;
}

function pickRandomSet(packId, exceptId) {
  if (packId) {
    const preferred = getDb()
      .prepare(
        `SELECT * FROM quiz_sets WHERE pack_id = ? AND id != ? ORDER BY RANDOM() LIMIT 1`
      )
      .get(packId, exceptId ?? -1);
    return (
      preferred ||
      getDb()
        .prepare(`SELECT * FROM quiz_sets WHERE pack_id = ? ORDER BY RANDOM() LIMIT 1`)
        .get(packId)
    );
  }

  const preferred = getDb()
    .prepare(`SELECT * FROM quiz_sets WHERE id != ? ORDER BY RANDOM() LIMIT 1`)
    .get(exceptId ?? -1);
  return (
    preferred ||
    getDb().prepare(`SELECT * FROM quiz_sets ORDER BY RANDOM() LIMIT 1`).get()
  );
}

export function pickQuizSet(coupleId, packSlug, setSlug) {
  if (setSlug) {
    if (packSlug) {
      const pack = getPackBySlug(packSlug);
      if (!pack) return null;
      const set = getSetBySlug(pack.id, setSlug);
      if (!set) return null;
      return { pack, set };
    }

    const matches = getDb()
      .prepare(
        `SELECT s.*, p.slug AS pack_slug FROM quiz_sets s
         JOIN quiz_packs p ON p.id = s.pack_id
         WHERE s.slug = ?`
      )
      .all(setSlug);
    if (matches.length === 1) {
      return { pack: getPack(matches[0].pack_id), set: getSet(matches[0].id) };
    }
    if (matches.length > 1) return null;
    return null;
  }

  const pack = packSlug ? getPackBySlug(packSlug) : null;
  if (packSlug && !pack) return null;

  const unused = unusedSets(coupleId, pack?.id);
  const set = unused[0] || pickRandomSet(pack?.id, lastCompletedSetId(coupleId, pack?.id));
  if (!set) return null;
  return { pack: pack || getPack(set.pack_id), set };
}

export function startQuiz(coupleId, packSlug, setSlug) {
  const pending = getPendingQuiz(coupleId);
  if (pending) {
    return {
      alreadyPending: true,
      round: pending,
      pack: getPack(pending.pack_id),
      set: getSet(pending.set_id),
    };
  }

  const picked = pickQuizSet(coupleId, packSlug, setSlug);
  if (!picked) {
    if (setSlug) throw new Error("Unknown quiz in that pack.");
    if (packSlug) throw new Error(`Unknown quiz pack: ${packSlug}`);
    throw new Error("No quiz packs seeded.");
  }

  const result = getDb()
    .prepare(
      `INSERT INTO quiz_rounds (couple_id, pack_id, set_id, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(coupleId, picked.pack.id, picked.set.id, now());

  return {
    alreadyPending: false,
    round: getQuizRound(result.lastInsertRowid),
    pack: picked.pack,
    set: picked.set,
  };
}

export function getQuizAnswer(roundId, userId, itemId) {
  return getDb()
    .prepare(
      `SELECT * FROM quiz_answers WHERE round_id = ? AND user_id = ? AND item_id = ?`
    )
    .get(roundId, userId, itemId);
}

export function listQuizAnswers(roundId) {
  return getDb()
    .prepare(`SELECT * FROM quiz_answers WHERE round_id = ?`)
    .all(roundId);
}

function ensureAnswerRow(roundId, userId, itemId) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO quiz_answers (round_id, user_id, item_id)
       VALUES (?, ?, ?)`
    )
    .run(roundId, userId, itemId);
}

export function saveSelfAnswer(roundId, userId, itemId, selfIndex) {
  ensureAnswerRow(roundId, userId, itemId);
  getDb()
    .prepare(
      `UPDATE quiz_answers SET self_index = ? WHERE round_id = ? AND user_id = ? AND item_id = ?`
    )
    .run(selfIndex, roundId, userId, itemId);
}

export function saveGuessAnswer(roundId, userId, itemId, guessIndex) {
  ensureAnswerRow(roundId, userId, itemId);
  getDb()
    .prepare(
      `UPDATE quiz_answers SET guess_index = ? WHERE round_id = ? AND user_id = ? AND item_id = ?`
    )
    .run(guessIndex, roundId, userId, itemId);
}

export function nextQuizStep(round, userId) {
  const items = getRoundItems(round);
  for (const item of items) {
    const row = getQuizAnswer(round.id, userId, item.id);
    if (row?.self_index == null) {
      return { kind: "self", item, index: item.position, total: items.length };
    }
    if (row?.guess_index == null) {
      return { kind: "guess", item, index: item.position, total: items.length };
    }
  }
  return { kind: "done", item: null, index: items.length, total: items.length };
}

export function userFinishedQuiz(round, userId) {
  return nextQuizStep(round, userId).kind === "done";
}

export function bothFinishedQuiz(round, couple) {
  return couple.members.every((id) => userFinishedQuiz(round, id));
}

export function completeQuizIfReady(round, couple) {
  if (!bothFinishedQuiz(round, couple) || round.completed_at) return false;
  getDb()
    .prepare(`UPDATE quiz_rounds SET completed_at = ? WHERE id = ?`)
    .run(now(), round.id);
  round.completed_at = now();
  return true;
}

export function scoreQuiz(round, couple) {
  const items = getRoundItems(round);
  const answers = listQuizAnswers(round.id);
  const scores = {};
  for (const userId of couple.members) scores[userId] = 0;

  const details = items.map((item) => {
    const byUser = {};
    for (const userId of couple.members) {
      const row = answers.find(
        (a) => a.user_id === userId && a.item_id === item.id
      );
      byUser[userId] = row;
    }

    const hits = {};
    for (const userId of couple.members) {
      const partnerId = getPartnerId(couple, userId);
      const guess = byUser[userId]?.guess_index;
      const partnerSelf = byUser[partnerId]?.self_index;
      const correct = guess != null && guess === partnerSelf;
      if (correct) scores[userId] += 1;
      hits[userId] = { guess, partnerSelf, correct };
    }

    return { item, byUser, hits };
  });

  return { items, scores, details, total: items.length };
}

export { getPartnerId };
