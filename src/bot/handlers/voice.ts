import { Bot, InlineKeyboard, InputFile } from "grammy";
import { t } from "../../config/i18n.js";
import { resolveUiLanguage } from "../lang.js";
import { PT_VOICES, voiceLabel, findVoice, isKnownVoice } from "../../config/voices.js";
import { setUserVoice } from "../../db/queries.js";
import type { Providers } from "../../providers/index.js";

/**
 * /voice — pick the narrator voice. Choices are rendered as inline buttons;
 * selecting one persists it per user and plays a short sample in that voice.
 */
export function registerVoiceHandlers(bot: Bot, providers: Providers): void {
  bot.command("voice", async (ctx) => {
    const lang = resolveUiLanguage(ctx);
    const keyboard = new InlineKeyboard();
    for (const v of PT_VOICES) keyboard.text(voiceLabel(v), `voice:${v.id}`).row();
    await ctx.reply(t(lang, "voice_menu_title"), { reply_markup: keyboard });
  });

  bot.callbackQuery(/^voice:(.+)$/, async (ctx) => {
    const lang = resolveUiLanguage(ctx);
    const voiceId = ctx.match[1] ?? "";

    if (!isKnownVoice(voiceId)) {
      await ctx.answerCallbackQuery();
      return;
    }
    const voice = findVoice(voiceId)!;

    // Persist (best-effort — UI still reacts even if the DB is unavailable).
    try {
      if (ctx.from) await setUserVoice(ctx.from.id, voiceId, lang);
    } catch (e) {
      console.warn("setUserVoice failed (continuing):", e);
    }

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`${t(lang, "voice_changed")} ${voiceLabel(voice)}`);

    // Play a short sample in the chosen voice.
    try {
      const sample = await providers.tts.synthesize(
        "Olá! Vamos praticar o português europeu.",
        { voice: voiceId },
      );
      await ctx.replyWithVoice(new InputFile(sample.data, "amostra.ogg"));
    } catch (e) {
      console.warn("voice sample failed (continuing):", e);
    }
  });
}
