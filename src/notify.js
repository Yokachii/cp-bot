export async function dmUser(client, userId, payload) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(payload);
    return true;
  } catch (error) {
    console.error(`Could not DM ${userId}:`, error.message);
    return false;
  }
}

export async function sendToCoupleChannel(client, couple, payload) {
  if (!couple.channel_id) return false;
  try {
    const channel = await client.channels.fetch(couple.channel_id);
    if (channel?.isTextBased()) {
      await channel.send(payload);
      return true;
    }
  } catch (error) {
    console.error("Could not post to couple channel:", error.message);
  }
  return false;
}

export async function sendToCouple(client, couple, payload) {
  for (const userId of couple.members) {
    await dmUser(client, userId, payload);
  }
  await sendToCoupleChannel(client, couple, payload);
}

export async function notifyPartner(client, couple, userId, payload) {
  const partnerId = couple.members.find((id) => id !== userId);
  if (partnerId) await dmUser(client, partnerId, payload);
  await sendToCoupleChannel(client, couple, payload);
}

export function todayParts(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return { year, month, day, iso: `${year}-${month}-${day}` };
}
