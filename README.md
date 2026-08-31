# Couple Bot

A Discord bot for couples: pair two accounts, track shared habits, and answer daily questions that stay hidden until both people have replied.

## Setup

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **Bot**, create a bot and copy the token. Enable **Message Content Intent** is not required. Keep **Server Members Intent** off unless you add features that need it later.
3. Invite the bot with `applications.commands` and `bot` scopes. Needed permissions: Send Messages, Embed Links, View Channels, Read Message History.
4. Users must be able to receive DMs from the bot (they may need to allow DMs from server members).

```bash
cd couple-bot
copy .env.example .env
npm install
```

Edit `.env`:

- `DISCORD_TOKEN` — bot token
- `CLIENT_ID` — application ID
- `GUILD_ID` — optional, one server ID so slash commands appear immediately while you develop
- `DAILY_QUESTION_CRON` / `DAILY_QUESTION_TIMEZONE` — when automatic questions are sent

```bash
npm start
```

## Commands

| Command | What it does |
| --- | --- |
| `/couple pair @user` | Sends an invite. The other person accepts or declines. |
| `/couple leave` | Unlinks the pair. |
| `/couple channels [questions] [quizzes] [bucketlist] [habits]` | Sets a channel per feature (no options = view current setup). |
| `/couple set [name] [since] [my_birthday] [partner_birthday]` | Personalizes the couple card (name, anniversary, birthdays). |
| `/couple info` | Shows names, time together, birthdays, question/quiz stats, habits, channels. |
| `/question` | Draws a random question and DMs both partners. |
| `/decks [category]` | Shows how many unseen questions remain in each deck. |
| `/bucketlist add <idea> [description] [emoji]` | Adds an objective with its own emoji and details. |
| `/bucketlist complete goal:<#number>` | Checks an objective off by its list number. |
| `/bucketlist remove goal:<#number>` | Deletes an objective from the list. |
| `/bucketlist list` | Shows the checklist (each line starts with its #number). |
| `/bucketlist resend` | Re-posts the permanent bucket-list message if it was deleted. |
| `/habit add` / `/habit log` / `/habit list` | Shared habit tracking. |
| `/mood set mood:<preset or custom> [emoji] [description]` | Shares your current mood; your partner gets a DM. |
| `/mood view` / `/mood clear` | See both current moods / clear yours. |
| `/help` | Lists every command with details. |

## How questions work

1. A round starts from `/question` or the daily schedule.
2. Both partners get a DM with an **Answer** button (modal).
3. Answers are stored privately.
4. When the second answer arrives, both people (and the optional couple channel) see both answers.

Questions live in `src/data/questions.json` and are seeded into SQLite on startup. Add prompts there, then restart the bot.

## Bucket list channel

Set a bucket-list channel with `/couple channels bucketlist:#channel`. The bot keeps **one permanent message** there holding the whole list — open objectives (number, emoji, title, description) plus a separate "Done together" section. Every add/complete/remove just edits that message; nothing else is ever posted in the channel. If the message gets deleted, the bot re-creates it on the next change, or you can force it with `/bucketlist resend`.

The list is built to scale: each objective shows a stable `#number` (creation order), used with `/bucketlist complete goal:<#number>` and `/bucketlist remove goal:<#number>` — no buttons, so lists of 50+ objectives work fine. (Discord caps one message at ~6,000 characters; if the list outgrows that, the message shows the first chunk and notes how many items are hidden.)

## Database

Local SQLite file: `data/couple-bot.sqlite`.

- `couples` — one row per pair (`user_a_id`, `user_b_id`), plus optional `guild_id`, `channel_id`, and a JSON `data` object for extra couple fields
- `habits` / `habit_logs` — shared habits
- `questions` / `question_rounds` / `answers` — Q&A rounds
