import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "couple-bot.sqlite");

/** @type {import("better-sqlite3").Database | null} */
let db = null;

export function getDb() {
  if (!db) {
    throw new Error("Database is not initialized. Call initDb() first.");
  }
  return db;
}

export function initDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS couples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_a_id TEXT NOT NULL,
      user_b_id TEXT NOT NULL,
      guild_id TEXT,
      channel_id TEXT,
      quiz_channel_id TEXT,
      bucketlist_channel_id TEXT,
      habit_channel_id TEXT,
      bucketlist_message_id TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      UNIQUE(user_a_id, user_b_id)
    );

    CREATE TABLE IF NOT EXISTS couple_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      guild_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      goal_per_day INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
      UNIQUE(couple_id, user_id, name)
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      logged_at INTEGER NOT NULL,
      note TEXT,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_streaks (
      habit_id INTEGER NOT NULL PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_logged_date TEXT,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'general'
    );

    CREATE TABLE IF NOT EXISTS question_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      round_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      submitted_at INTEGER NOT NULL,
      PRIMARY KEY (round_id, user_id),
      FOREIGN KEY (round_id) REFERENCES question_rounds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS quiz_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      options_json TEXT NOT NULL,
      FOREIGN KEY (pack_id) REFERENCES quiz_packs(id) ON DELETE CASCADE,
      UNIQUE(pack_id, position)
    );

    CREATE TABLE IF NOT EXISTS quiz_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      pack_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
      FOREIGN KEY (pack_id) REFERENCES quiz_packs(id)
    );

    CREATE TABLE IF NOT EXISTS quiz_answers (
      round_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      self_index INTEGER,
      guess_index INTEGER,
      PRIMARY KEY (round_id, user_id, item_id),
      FOREIGN KEY (round_id) REFERENCES quiz_rounds(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES quiz_items(id)
    );

    CREATE TABLE IF NOT EXISTS bucket_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      idea TEXT NOT NULL,
      description TEXT,
      emoji TEXT,
      added_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      completed_by TEXT,
      FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      caption TEXT NOT NULL,
      photo_url TEXT,
      happened_on TEXT NOT NULL,
      added_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_throwback_year INTEGER,
      FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS question_seen (
      couple_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      drawn_at INTEGER NOT NULL,
      PRIMARY KEY (couple_id, question_id),
      FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );

    CREATE TABLE IF NOT EXISTS quiz_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      UNIQUE(pack_id, slug),
      FOREIGN KEY (pack_id) REFERENCES quiz_packs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS moods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT,
      title TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(couple_id, user_id),
      FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
    );
  `);

  migrateQuizSchema();
  migrateHabitSchema();
  migrateCoupleChannels();
  migrateBucketItems();
  seedQuestions();
  seedQuizzes();
  return db;
}

function migrateCoupleChannels() {
  const cols = tableColumns("couples");
  if (!cols.includes("quiz_channel_id")) {
    db.exec(`ALTER TABLE couples ADD COLUMN quiz_channel_id TEXT`);
  }
  if (!cols.includes("bucketlist_channel_id")) {
    db.exec(`ALTER TABLE couples ADD COLUMN bucketlist_channel_id TEXT`);
  }
  if (!cols.includes("habit_channel_id")) {
    db.exec(`ALTER TABLE couples ADD COLUMN habit_channel_id TEXT`);
  }
  if (!cols.includes("bucketlist_message_id")) {
    db.exec(`ALTER TABLE couples ADD COLUMN bucketlist_message_id TEXT`);
  }
}

function migrateBucketItems() {
  const cols = tableColumns("bucket_items");
  if (!cols.includes("description")) {
    db.exec(`ALTER TABLE bucket_items ADD COLUMN description TEXT`);
  }
  if (!cols.includes("emoji")) {
    db.exec(`ALTER TABLE bucket_items ADD COLUMN emoji TEXT`);
  }
}

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}

function migrateHabitSchema() {
  const habitCols = tableColumns("habits");

  // Add user_id if it doesn't exist (migrate from old shared to new individual habits).
  // Drop any stale leftover from a previously interrupted migration first, and keep
  // user_id nullable so legacy shared habits (which have no owner) can be carried over.
  if (!habitCols.includes("user_id")) {
    db.exec(`DROP TABLE IF EXISTS habits_new`);
    db.pragma("foreign_keys = OFF");
    db.exec(`
      CREATE TABLE habits_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        couple_id INTEGER NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        goal_per_day INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
        UNIQUE(couple_id, user_id, name)
      );
      INSERT INTO habits_new (id, couple_id, user_id, name, goal_per_day, created_at)
        SELECT id, couple_id, NULL, name, 1, created_at FROM habits;
      DROP TABLE habits;
      ALTER TABLE habits_new RENAME TO habits;
    `);
    db.pragma("foreign_keys = ON");
  }
  
  // Check if habit_logs needs migration (remove user_id)
  const logCols = tableColumns("habit_logs");
  if (logCols.includes("user_id")) {
    db.exec(`DROP TABLE IF EXISTS habit_logs_new`);
    db.pragma("foreign_keys = OFF");
    db.exec(`
      CREATE TABLE habit_logs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL,
        logged_at INTEGER NOT NULL,
        note TEXT,
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
      );
      INSERT INTO habit_logs_new (id, habit_id, logged_at, note)
        SELECT id, habit_id, logged_at, note FROM habit_logs;
      DROP TABLE habit_logs;
      ALTER TABLE habit_logs_new RENAME TO habit_logs;
    `);
    db.pragma("foreign_keys = ON");
  }
  
  // Create habit_streaks if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS habit_streaks (
      habit_id INTEGER NOT NULL PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_logged_date TEXT,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );
  `);
  
  // Initialize streak records for existing habits
  const habitIds = db.prepare(`SELECT id FROM habits`).all();
  const insertStreak = db.prepare(
    `INSERT OR IGNORE INTO habit_streaks (habit_id, current_streak, longest_streak, last_logged_date)
     VALUES (?, 0, 0, NULL)`
  );
  for (const habit of habitIds) {
    insertStreak.run(habit.id);
  }
}

function migrateQuizSchema() {
  const itemCols = tableColumns("quiz_items");
  if (!itemCols.includes("set_id")) {
    db.exec(`ALTER TABLE quiz_items ADD COLUMN set_id INTEGER`);
  }

  const roundCols = tableColumns("quiz_rounds");
  if (!roundCols.includes("set_id")) {
    db.exec(`ALTER TABLE quiz_rounds ADD COLUMN set_id INTEGER`);
  }

  const packs = db.prepare(`SELECT id FROM quiz_packs`).all();
  const insertClassic = db.prepare(
    `INSERT OR IGNORE INTO quiz_sets (pack_id, slug, title, position)
     VALUES (?, 'classic', 'Classic', 0)`
  );
  const getClassic = db.prepare(
    `SELECT id FROM quiz_sets WHERE pack_id = ? AND slug = 'classic'`
  );
  for (const pack of packs) {
    insertClassic.run(pack.id);
    const set = getClassic.get(pack.id);
    if (!set) continue;
    db.prepare(
      `UPDATE quiz_items SET set_id = ? WHERE pack_id = ? AND set_id IS NULL`
    ).run(set.id, pack.id);
    db.prepare(
      `UPDATE quiz_rounds SET set_id = ? WHERE pack_id = ? AND set_id IS NULL`
    ).run(set.id, pack.id);
  }

  const createSql = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'quiz_items'`)
    .get()?.sql;
  if (createSql && createSql.includes("UNIQUE(pack_id, position)")) {
    db.exec(`DROP TABLE IF EXISTS quiz_items_new`);
    db.pragma("foreign_keys = OFF");
    db.exec(`
      CREATE TABLE quiz_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pack_id INTEGER NOT NULL,
        set_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        options_json TEXT NOT NULL,
        FOREIGN KEY (pack_id) REFERENCES quiz_packs(id) ON DELETE CASCADE,
        FOREIGN KEY (set_id) REFERENCES quiz_sets(id) ON DELETE CASCADE,
        UNIQUE(set_id, position)
      );
      INSERT INTO quiz_items_new (id, pack_id, set_id, position, prompt, options_json)
        SELECT id, pack_id, set_id, position, prompt, options_json
        FROM quiz_items
        WHERE set_id IS NOT NULL;
      DROP TABLE quiz_items;
      ALTER TABLE quiz_items_new RENAME TO quiz_items;
    `);
    db.pragma("foreign_keys = ON");
  }

  db.exec(`
    INSERT OR IGNORE INTO question_seen (couple_id, question_id, drawn_at)
    SELECT couple_id, question_id, created_at FROM question_rounds
  `);
}

function seedQuestions() {
  const seedPath = path.join(__dirname, "data", "questions.json");
  const items = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const insert = db.prepare(
    "INSERT OR IGNORE INTO questions (prompt, category) VALUES (?, ?)"
  );
  const updateCategory = db.prepare(
    "UPDATE questions SET category = ? WHERE prompt = ?"
  );

  const seed = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(row.prompt, row.category);
      updateCategory.run(row.category, row.prompt);
    }
  });

  seed(items);
}

function normalizePackQuizzes(pack) {
  // Support new structure with themes
  if (pack.themeSlug) {
    return {
      slug: pack.themeSlug,
      title: pack.themeTitle,
      description: pack.themeDescription || "",
      quizzes: pack.quizzes || [],
    };
  }
  
  // Support old structure with direct quizzes array
  if (Array.isArray(pack.quizzes) && pack.quizzes.length) {
    return {
      slug: pack.slug,
      title: pack.title,
      description: pack.description || "",
      quizzes: pack.quizzes,
    };
  }
  
  // Support old structure with questions array
  if (Array.isArray(pack.questions) && pack.questions.length) {
    return {
      slug: pack.slug,
      title: pack.title,
      description: pack.description || "",
      quizzes: [{ slug: "classic", title: pack.title, questions: pack.questions }],
    };
  }
  
  return null;
}

function seedQuizzes() {
  const seedPath = path.join(__dirname, "data", "quizzes.json");
  const rawData = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  
  // Handle both old format (array of packs) and new format (themes)
  let packs = [];
  if (Array.isArray(rawData)) {
    for (const item of rawData) {
      const normalized = normalizePackQuizzes(item);
      if (normalized) {
        packs.push(normalized);
      }
    }
  }

  const activePackSlugs = packs.map((pack) => pack.slug);
  const stalePackIds = db.prepare(
    `SELECT id FROM quiz_packs WHERE slug NOT IN (${activePackSlugs.map(() => "?").join(", ")})`
  ).all(...activePackSlugs).map((row) => row.id);

  if (stalePackIds.length) {
    const deleteRounds = db.prepare(`DELETE FROM quiz_rounds WHERE pack_id = ?`);
    const deletePack = db.prepare(`DELETE FROM quiz_packs WHERE id = ?`);

    db.transaction(() => {
      for (const packId of stalePackIds) {
        deleteRounds.run(packId);
        deletePack.run(packId);
      }
    })();
  }
  
  const upsertPack = db.prepare(
    `INSERT INTO quiz_packs (slug, title, description) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET title = excluded.title, description = excluded.description`
  );
  const getPackId = db.prepare(`SELECT id FROM quiz_packs WHERE slug = ?`);
  const upsertSet = db.prepare(
    `INSERT INTO quiz_sets (pack_id, slug, title, position) VALUES (?, ?, ?, ?)
     ON CONFLICT(pack_id, slug) DO UPDATE SET title = excluded.title, position = excluded.position`
  );
  const getSet = db.prepare(
    `SELECT id FROM quiz_sets WHERE pack_id = ? AND slug = ?`
  );
  const upsertItem = db.prepare(
    `INSERT INTO quiz_items (pack_id, set_id, position, prompt, options_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(set_id, position) DO UPDATE SET
       prompt = excluded.prompt,
       options_json = excluded.options_json`
  );
  const deleteExtraItems = db.prepare(
    `DELETE FROM quiz_items WHERE set_id = ? AND position >= ?`
  );
  const listSets = db.prepare(`SELECT id, slug FROM quiz_sets WHERE pack_id = ?`);
  const deleteSet = db.prepare(`DELETE FROM quiz_sets WHERE id = ?`);

  const seed = db.transaction((rows) => {
    for (const pack of rows) {
      upsertPack.run(pack.slug, pack.title, pack.description);
      const { id: packId } = getPackId.get(pack.slug);
      
      const quizzes = pack.quizzes || [];
      const slugs = new Set(quizzes.map((quiz) => quiz.slug));

      quizzes.forEach((quiz, setIndex) => {
        upsertSet.run(packId, quiz.slug, quiz.title, setIndex);
        const { id: setId } = getSet.get(packId, quiz.slug);
        
        const questions = quiz.questions || [];
        questions.forEach((question, index) => {
          upsertItem.run(
            packId,
            setId,
            index,
            question.prompt,
            JSON.stringify(question.options)
          );
        });
        deleteExtraItems.run(setId, questions.length);
      });

      for (const row of listSets.all(packId)) {
        if (!slugs.has(row.slug)) deleteSet.run(row.id);
      }
    }
  });

  seed(packs);
}

export function orderedUserIds(id1, id2) {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

export function now() {
  return Date.now();
}
