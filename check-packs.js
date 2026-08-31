import Database from "better-sqlite3";

const db = new Database("data/couple-bot.sqlite");

const packs = db.prepare(`
  SELECT 
    p.id, 
    p.slug, 
    p.title, 
    COUNT(DISTINCT s.id) as quiz_count 
  FROM quiz_packs p 
  LEFT JOIN quiz_sets s ON s.pack_id = p.id 
  GROUP BY p.id 
  ORDER BY p.title
`).all();

console.log("\nAll Quiz Packs in Database:");
console.log("============================");
packs.forEach(pack => {
  console.log(`${pack.title} (${pack.slug}): ${pack.quiz_count} quizzes`);
});

console.log("\nTotal packs:", packs.length);
