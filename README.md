# Fala Certo — European Portuguese learning bot

Telegram bot that teaches **European Portuguese (pt-PT)** to migrants and expats
in Portugal: translator, spelling/grammar coach and voice conversation partner.
UI in Ukrainian and Russian. See [CLAUDE.md](CLAUDE.md) for the full design.

> **Status:** skeleton. `/start` works; providers are stubs returning fake data
> so the whole Telegram → bot → reply flow runs offline before real APIs are
> wired. Voice logic is not implemented yet.

## Quick start

```bash
npm install
cp .env.example .env        # fill in BOT_TOKEN (from @BotFather)
npm run dev                 # long polling, stub providers
```

Then message the bot: `/start` shows the welcome and a 3-mode menu.

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Run with tsx + watch (long polling)           |
| `npm run typecheck` | `tsc --noEmit`                                |
| `npm run build`     | Compile to `dist/`                            |
| `npm start`         | Run the compiled build                        |

## Project layout

```
src/
  bot/         grammY setup + one handler per mode (handlers/)
  providers/   SttProvider · TtsProvider · LlmProvider (interfaces + stubs)
  core/        lesson logic, SRS scheduler, prompt builders, JSON parsing
  db/          Supabase client, queries, types, schema.sql
  config/      env loader, i18n language packs (uk/ru)
  index.ts     entry point (long polling)
```

## Configuration

All env vars live in [.env.example](.env.example). Key one:

- `PROVIDER_MODE=stub` (default) — fake providers, no external calls.
- `PROVIDER_MODE=live` — real Groq Whisper / Gemini / Piper (not wired yet).

Supabase is optional for now: the bot boots and answers `/start` without it.
When ready, run [src/db/schema.sql](src/db/schema.sql) in the Supabase SQL editor.

## Roadmap (iterations)

1. ✅ Skeleton + stub providers + `/start`.
2. Real Groq Whisper in `SttProvider`.
3. Real Gemini in `LlmProvider`.
4. Real Piper in `TtsProvider`.
5. Full mode-1 voice loop: voice → Whisper → Gemini eval → Supabase → Piper + text.
