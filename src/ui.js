import { EmbedBuilder } from "discord.js";

export const colors = {
  blush: 0xf4a5c0,
  lilac: 0x8b7cf6,
  gold: 0xe8b86d,
  sea: 0x5e9aa8,
  sage: 0x6f9b78,
  rose: 0xc45c7a,
  ink: 0x3d3348,
  cream: 0xf6efe6,
};

export const brand = "couple bot";

export function progressBar(done, total, size = 8) {
  if (!total) return "▱".repeat(size);
  const ratio = Math.max(0, Math.min(1, done / total));
  const filled = Math.round(ratio * size);
  return `${"▰".repeat(filled)}${"▱".repeat(size - filled)}`;
}

export function truncate(text, max) {
  if (!text) return "";
  const value = String(text);
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function embed({ color = colors.blush, title, description, footer } = {}) {
  const result = new EmbedBuilder().setColor(color);
  if (title) result.setTitle(title);
  if (description) result.setDescription(description);
  result.setFooter({ text: footer || brand });
  return result;
}

export function formatWhen(isoDate) {
  if (!isoDate) return "today";
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function durationBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return "";
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const from = new Date(Date.UTC(fy, fm - 1, fd));
  const to = new Date(Date.UTC(ty, tm - 1, td));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return "";
  }

  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days && !years) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "day one";
}
