import fs from "node:fs";

const results = [];
const check = (label, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` | ${detail}` : ""}`);
};

// 1. Load the module — catches load-time errors
const i = await import("./src/interactions.js");
check("interactions.js loads", typeof i.handleInteraction === "function");

// 2. Static check: every export of every local module that is USED in
//    interactions.js must also be IMPORTED there (catches ReferenceErrors
//    like the recent `listBucketItems is not defined`).
const source = fs.readFileSync("src/interactions.js", "utf8");
const bodyStart = source.indexOf("const ephemeral");
const body = bodyStart === -1 ? source : source.slice(bodyStart);

const importedNames = new Set();
for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
  for (const raw of match[1].split(",")) {
    const name = raw.trim().split(/\s+as\s+/).pop().trim();
    if (name) importedNames.add(name);
  }
}

const localModules = [
  "./src/config.js",
  "./src/db.js",
  "./src/couples.js",
  "./src/questions.js",
  "./src/quizzes.js",
  "./src/quizUi.js",
  "./src/bucketlist.js",
  "./src/moods.js",
  "./src/memories.js",
  "./src/notify.js",
  "./src/ui.js",
];

let missing = [];
for (const mod of localModules) {
  const ns = await import(mod);
  for (const name of Object.keys(ns)) {
    if (typeof ns[name] !== "function" && typeof ns[name] !== "object") continue;
    const used = new RegExp(`\\b${name}\\s*\\(`).test(body) || new RegExp(`\\b${name}\\b`).test(body);
    if (used && !importedNames.has(name)) {
      missing.push(`${name} (from ${mod})`);
    }
  }
}
check("no used-but-unimported identifiers", missing.length === 0, missing.join(", ") || "all clear");

// 3. The exact call that crashed now resolves through the module graph
const bl = await import("./src/bucketlist.js");
check("listBucketItems is exported and callable", typeof bl.listBucketItems === "function");
const { initDb, getDb } = await import("./src/db.js");
initDb();
const coupleRow = getDb().prepare(`SELECT id FROM couples LIMIT 1`).get();
if (coupleRow) {
  const items = bl.listBucketItems(coupleRow.id);
  check("listBucketItems runs against live DB", Array.isArray(items), `items=${items.length}`);
} else {
  results.push("SKIP — no couple in DB");
}

// 4. Commands still build
const c = await import("./src/commands.js");
check("9 commands registered", c.commandData.length === 9, c.commandData.map((cmd) => cmd.name).join(", "));

const out = results.join("\n") + `\n${results.every((r) => !r.startsWith("FAIL")) ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}`;
console.log(out);
fs.writeFileSync("_verify.txt", out);