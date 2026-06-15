import { Bot, Context, InlineKeyboard } from "grammy";
import { t, type UiLanguage } from "../../config/i18n.js";
import { resolveUiLanguage } from "../lang.js";
import { randomPracticeWord, practiceTranslation } from "../../core/practiceWords.js";
import { setTarget, clearTarget } from "../practiceState.js";

/** Inline buttons shown under target-practice feedback. */
export function practiceKeyboard(lang: UiLanguage): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, "practice_next_btn"), "practice:next")
    .text(t(lang, "practice_free_btn"), "practice:free");
}

/**
 * Pick a word and set it as the target. Only the word is shown (text) — the
 * model pronunciation is played later, together with the feedback, after the
 * user records their own attempt.
 */
async function sendPracticeWord(ctx: Context, lang: UiLanguage): Promise<void> {
  const word = randomPracticeWord();
  if (ctx.from) setTarget(ctx.from.id, word.pt);

  await ctx.reply(
    `${t(lang, "practice_intro")} <b>${word.pt}</b> — ${practiceTranslation(word, lang)}\n\n` +
      t(lang, "practice_send_hint"),
    { parse_mode: "HTML" },
  );
}

export function registerPracticeHandlers(bot: Bot): void {
  bot.command("practice", async (ctx) => {
    await sendPracticeWord(ctx, resolveUiLanguage(ctx));
  });

  // "Repeat after me" menu button (either UI language).
  bot.hears(
    [t("uk", "menu_mode_practice"), t("ru", "menu_mode_practice")],
    async (ctx) => sendPracticeWord(ctx, resolveUiLanguage(ctx)),
  );

  bot.callbackQuery("practice:next", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendPracticeWord(ctx, resolveUiLanguage(ctx));
  });

  bot.callbackQuery("practice:free", async (ctx) => {
    const lang = resolveUiLanguage(ctx);
    if (ctx.from) clearTarget(ctx.from.id);
    await ctx.answerCallbackQuery();
    await ctx.reply(t(lang, "practice_free_on"));
  });
}
