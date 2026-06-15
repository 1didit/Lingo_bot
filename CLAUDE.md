# European Portuguese Learning Bot (working name: Fala Certo)

> Context file for Claude Code. Keep this updated as the project evolves.

## What we're building
A Telegram bot that teaches **European Portuguese (pt-PT, NOT Brazilian)** to migrants
and expats living in Portugal. The bot is a translator, spelling/grammar coach, and
conversation partner — with voice support as a core feature. The UI is multilingual;
the first interface languages are Ukrainian and Russian.

## Target users
Migrants/expats in Portugal who need practical, correct European Portuguese for daily
life (health system, housing, work, local services). Pronunciation and stress matter,
so voice is a first-class feature, not an add-on.

## Learning modes (MVP scope)
1. **Words & stress** — user speaks a word; bot returns the correct translation,
   spelling, and stress marks, plus pronunciation feedback.
2. **Sentence building** — bot gives target sentences; user constructs/answers them;
   bot corrects word order, grammar, and stress.
3. **Conversation** — bot holds a simple dialogue and asks questions; user answers by
   voice; bot analyzes the answer and explains how to say it correctly.

Every mode explains errors WITH the underlying grammar rule, in the user's native language.

## Tech stack
- **Bot framework:** grammY (TypeScript). Long polling in dev, webhook in prod.
- **Dev runtime:** runs locally on the dev machine — no server needed for testing.
- **LLM (translation, grammar, error analysis):** Google Gemini (Flash), free tier in dev.
- **STT (speech-to-text):** Groq Whisper API (free tier). Pronunciation feedback =
  Whisper transcript compared against the target text by the LLM.
- **TTS (bot voice / pronunciation model):** Piper, local, pt-PT voice. Outputs OGG/Opus
  for Telegram.
- **Database:** Supabase (Postgres) — users, progress, vocabulary, spaced-repetition state.
- **Scheduler:** cron for reminders + spaced repetition (Supabase pg_cron or host cron).

## Architecture principles
- **No GPU required.** STT is offloaded to an API; TTS (Piper) is CPU-light. Production
  target is a cheap CPU server (e.g. Hetzner ~EUR 4/mo, EU region for GDPR), not a GPU box.
- **Swappable providers.** Wrap STT, TTS, and LLM behind small interfaces
  (`SttProvider`, `TtsProvider`, `LlmProvider`). A provider must be changeable in one
  place — never call a vendor SDK directly from a bot handler.
- **Spaced repetition (SRS) is the retention engine.** Track which items a user gets
  wrong and reschedule them. First-class feature, not optional.
- **European Portuguese only.** Avoid Brazilian forms in prompts and content. Always
  specify pt-PT explicitly when prompting the LLM.
- **GDPR-aware.** Users are in the EU. Don't retain raw voice/personal data longer than
  needed; switch to the paid LLM tier (no training on data) before public launch.

## Suggested project structure
- `src/bot/` — grammY setup, one handler per mode
- `src/providers/` — `stt.ts`, `tts.ts`, `llm.ts` (interfaces + implementations)
- `src/core/` — lesson logic, SRS scheduler, prompt builders
- `src/db/` — Supabase client + queries
- `src/config/` — env, language packs (UK/RU UI strings)

## Data model (initial)
- `users` — telegram_id, native_language, level (CEFR A1-C2), created_at
- `vocabulary` — word_pt, translation, stress_pattern, audio_ref
- `progress` — user_id, item_id, status, ease, next_review_at (SRS)
- `sessions` — user_id, mode, started_at (dialogue context)

## Current priority
Build **mode 1 (words & stress) end-to-end with voice first**:
voice in -> Whisper -> Gemini eval -> Supabase save -> Piper voice out + text correction.
Get the full voice loop working for one mode before adding modes 2 and 3.

## Conventions
- TypeScript, async/await. No vendor SDK calls inside handlers — go through providers.
- Request LLM responses as JSON and parse them safely (strip code fences, try/catch).
- All user-facing strings go through the language pack (UK/RU) — never hardcode them.
