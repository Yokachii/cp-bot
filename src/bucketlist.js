import { getDb, now } from "./db.js";
import { setBucketlistMessageId } from "./couples.js";
import { colors, embed, progressBar, truncate } from "./ui.js";

const DEFAULT_EMOJI = "🌟";
const DESC_LIMIT = 4000; // per-embed description safety cap (Discord allows 4096)
const MESSAGE_BUDGET = 5600; // across all embeds in one message (Discord allows 6000)

function normalizeEmoji(emoji) {
  const value = (emoji || "").trim();
  if (!value) return DEFAULT_EMOJI;
  return value.slice(0, 32);
}

export function addBucketItem(coupleId, idea, userId, { emoji, description } = {}) {
  const result = getDb()
    .prepare(
      `INSERT INTO bucket_items (couple_id, idea, description, emoji, added_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      coupleId,
      idea.trim(),
      description?.trim() || null,
      normalizeEmoji(emoji),
      userId,
      now()
    );
  return result.lastInsertRowid;
}

export function listBucketItems(coupleId) {
  return getDb()
    .prepare(
      `SELECT * FROM bucket_items
       WHERE couple_id = ?
       ORDER BY (completed_at IS NULL) DESC, created_at ASC`
    )
    .all(coupleId);
}

export function listOpenBucketItems(coupleId) {
  return getDb()
    .prepare(
      `SELECT * FROM bucket_items
       WHERE couple_id = ? AND completed_at IS NULL
       ORDER BY created_at ASC`
    )
    .all(coupleId);
}

/**
 * Items in creation order, each tagged with a stable per-couple display id
 * (#0, #1, #2, …) that is shown on the list and used by /bucketlist
 * complete and /bucketlist remove. Numbers only shift when an item is removed.
 */
export function listBucketItemsNumbered(coupleId) {
  const items = getDb()
    .prepare(
      `SELECT * FROM bucket_items
       WHERE couple_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(coupleId);
  return items.map((item, index) => ({ ...item, display_id: index }));
}

export function getBucketItemByDisplayId(coupleId, displayId) {
  return (
    getDb()
      .prepare(
        `SELECT * FROM bucket_items
         WHERE couple_id = ?
         ORDER BY created_at ASC, id ASC
         LIMIT 1 OFFSET ?`
      )
      .get(coupleId, displayId) || null
  );
}

export function getBucketItem(id) {
  return getDb().prepare(`SELECT * FROM bucket_items WHERE id = ?`).get(id);
}

export function removeBucketItem(coupleId, itemId) {
  const existing = getBucketItem(itemId);
  if (!existing || existing.couple_id !== coupleId) {
    return { ok: false, reason: "missing" };
  }
  getDb().prepare(`DELETE FROM bucket_items WHERE id = ?`).run(itemId);
  return { ok: true, item: existing };
}

export function completeBucketItem(itemId, userId) {
  const existing = getBucketItem(itemId);
  if (!existing) return { ok: false, reason: "missing" };
  if (existing.completed_at) return { ok: false, reason: "already", item: existing };
  getDb()
    .prepare(
      `UPDATE bucket_items
       SET completed_at = ?, completed_by = ?
       WHERE id = ? AND completed_at IS NULL`
    )
    .run(now(), userId, itemId);
  return { ok: true, item: getBucketItem(itemId) };
}

function itemLine(item) {
  const emoji = item.emoji || DEFAULT_EMOJI;
  const title = truncate(item.idea, 90);
  const details = item.description ? ` — ${truncate(item.description, 100)}` : "";
  return `\`#${item.display_id}\` ${emoji} **${title}**${details}`;
}

/**
 * Built for huge lists: compact numbered lines instead of fields/buttons.
 * Items must carry display_id (see listBucketItemsNumbered).
 */
export function bucketListPayload(items) {
  const open = items.filter((item) => !item.completed_at);
  const done = items.filter((item) => item.completed_at);
  const empty = !items.length;

  let hidden = 0;
  let used = 0;

  const header = empty
    ? "Nothing here yet. Add a trip, film, meal, or tiny adventure with `/bucketlist add`."
    : `${progressBar(done.length, items.length)}  **${done.length}/${items.length}** checked off`;

  const openLines = [];
  let mainLen = header.length + 2;
  for (const item of open) {
    const line = itemLine(item);
    if (mainLen + line.length + 1 > DESC_LIMIT || used + line.length + 1 > MESSAGE_BUDGET) {
      hidden++;
      continue;
    }
    openLines.push(line);
    mainLen += line.length + 1;
    used += line.length + 1;
  }

  const main = embed({
    color: colors.gold,
    title: empty ? "Your bucket list" : "Bucket list",
    description: [header, "", ...openLines].join("\n"),
  });
  const embeds = [main];

  if (done.length) {
    const doneLines = [];
    let doneLen = 0;
    for (const item of done) {
      const line = itemLine(item);
      if (doneLen + line.length + 1 > DESC_LIMIT || used + line.length + 1 > MESSAGE_BUDGET) {
        hidden++;
        continue;
      }
      doneLines.push(line);
      doneLen += line.length + 1;
      used += line.length + 1;
    }
    if (doneLines.length) {
      embeds.push(
        embed({
          color: colors.sage,
          title: "✅ Done together",
          description: doneLines.join("\n"),
        })
      );
    }
  }

  let footer = empty
    ? "Start with one small thing you both want."
    : `${open.length} open · ${done.length} done · complete or remove with /bucketlist goal:<#number>`;
  if (hidden) footer += ` · …and ${hidden} more not shown`;
  main.setFooter({ text: footer });

  return { embeds, components: [] };
}

/**
 * Keeps exactly one permanent bucket-list message alive in the couple's
 * bucket-list channel. Edits the stored message with the current list;
 * if the message was deleted, posts a fresh one and remembers its id.
 */
export async function ensureBucketlistMessage(client, couple) {
  if (!couple.bucketlist_channel_id) return null;
  try {
    const channel = await client.channels.fetch(couple.bucketlist_channel_id);
    if (!channel || !channel.isTextBased()) return null;

    const payload = bucketListPayload(listBucketItemsNumbered(couple.id));

    if (couple.bucketlist_message_id) {
      try {
        const message = await channel.messages.fetch(couple.bucketlist_message_id);
        await message.edit(payload);
        return message;
      } catch {
        // Message is gone (deleted) — fall through and post a fresh one.
      }
    }

    const message = await channel.send(payload);
    setBucketlistMessageId(couple.id, message.id);
    return message;
  } catch (error) {
    console.error("Could not sync the bucket-list message:", error.message);
    return null;
  }
}

/**
 * Posts a brand-new permanent message (deleting the old one if it still
 * exists). Use when the couple wants a clean copy of the list.
 */
export async function resendBucketlistMessage(client, couple) {
  if (!couple.bucketlist_channel_id) return null;
  try {
    const channel = await client.channels.fetch(couple.bucketlist_channel_id);
    if (!channel || !channel.isTextBased()) return null;

    if (couple.bucketlist_message_id) {
      await channel.messages.delete(couple.bucketlist_message_id).catch(() => {});
    }
    setBucketlistMessageId(couple.id, null);
    return ensureBucketlistMessage(client, couple);
  } catch (error) {
    console.error("Could not re-post the bucket-list message:", error.message);
    return null;
  }
}