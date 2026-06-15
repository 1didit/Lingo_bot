import { Bot, InputFile } from "grammy";
import { t } from "../../config/i18n.js";
import { resolveUiLanguage } from "../lang.js";
import type { Providers } from "../../providers/index.js";
import { evaluateSpokenWord, formatWordEvaluation } from "../../core/lesson.js";
import { getTarget } from "../practiceState.js";
import { practiceKeyboard } from "./practice.js";
import {
  upsertUser,
  upsertVocabulary,
  recordAttempt,
  getUserByTelegramId,
} from "../../db/queries.js";

/**
 * Mode 1 — Words & stress. Full voice loop:
 *   voice in -> Whisper (STT) -> Gemini (LLM eval) -> text correction
 *            -> Piper (TTS) pronunciation -> Supabase save (SRS).
 *
 * The teaching steps (STT/LLM) are critical; the TTS reply and DB save are
 * best-effort so a hiccup in either never blanks out the correction.
 */
const MIME_EXT: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export function registerWordsHandlers(bot: Bot, providers: Providers): void {
  // "Words & stress" menu button in either UI language.
  bot.hears(
    [t("uk", "menu_mode_words"), t("ru", "menu_mode_words")],
    async (ctx) => {
      const lang = resolveUiLanguage(ctx);
      await ctx.reply(t(lang, "send_voice_hint"));
    },
  );

  bot.on(["message:voice", "message:audio"], async (ctx) => {
    const lang = resolveUiLanguage(ctx);
    try {
      await ctx.replyWithChatAction("typing");

      // 1. Download the audio from Telegram.
      const file = await ctx.getFile();
      if (!file.file_path) throw new Error("getFile returned no file_path");
      const media = ctx.message.voice ?? ctx.message.audio;
      const mimeType = media?.mime_type ?? "audio/ogg";
      const ext = MIME_EXT[mimeType] ?? "ogg";
      const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
      const audioData = Buffer.from(await res.arrayBuffer());

      // 2. STT -> LLM evaluation (the critical path). If a practice target is
      //    set, evaluate against it; otherwise it's free practice.
      const target = ctx.from ? getTarget(ctx.from.id) : undefined;
      const ev = await evaluateSpokenWord(providers, {
        audio: { data: audioData, mimeType, filename: `voice.${ext}` },
        nativeLanguage: lang,
        targetWord: target,
      });

      // 3. Text correction — send first, it matters most. In target practice,
      //    offer next-word / free-practice buttons.
      await ctx.reply(formatWordEvaluation(ev), {
        parse_mode: "HTML",
        reply_markup: target ? practiceKeyboard(lang) : undefined,
      });

      // 4. Model pronunciation via TTS in the user's chosen voice (best-effort).
      try {
        let voice: string | undefined;
        try {
          if (ctx.from) {
            voice = (await getUserByTelegramId(ctx.from.id))?.voice_id ?? undefined;
          }
        } catch {
          // No saved voice — provider falls back to its default.
        }
        const speech = await providers.tts.synthesize(ev.correctSpelling, { voice });
        await ctx.replyWithVoice(new InputFile(speech.data, "pronuncia.ogg"));
      } catch (e) {
        console.warn("TTS reply failed (continuing):", e);
      }

      // 5. Persist vocabulary + SRS progress (best-effort).
      try {
        if (ctx.from) {
          const user = await upsertUser({
            telegramId: ctx.from.id,
            nativeLanguage: lang,
          });
          const itemId = await upsertVocabulary({
            wordPt: ev.correctSpelling,
            translation: ev.translation,
            stressPattern: ev.stressPattern,
          });
          if (user && itemId) {
            await recordAttempt({ userId: user.id, itemId, wasCorrect: ev.isCorrect });
          }
        }
      } catch (e) {
        console.warn("progress save failed (continuing):", e);
      }
    } catch (err) {
      console.error("voice handler failed:", err);
      await ctx.reply(t(lang, "error_generic"));
    }
  });
}
