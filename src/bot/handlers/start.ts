import { Bot, Keyboard } from "grammy";
import { t } from "../../config/i18n.js";
import { resolveUiLanguage } from "../lang.js";
import { upsertUser } from "../../db/queries.js";

/**
 * /start and /help. The main menu offers the three learning modes. The reply
 * keyboard buttons reuse the same i18n strings the handlers match against.
 */
export function registerStartHandlers(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const lang = resolveUiLanguage(ctx);

    // Best-effort persistence: a missing/unconfigured DB must not break /start.
    if (ctx.from) {
      try {
        await upsertUser({ telegramId: ctx.from.id, nativeLanguage: lang });
      } catch (err) {
        console.warn("upsertUser failed (continuing):", err);
      }
    }

    const keyboard = new Keyboard()
      .text(t(lang, "menu_mode_words"))
      .row()
      .text(t(lang, "menu_mode_practice"))
      .row()
      .text(t(lang, "menu_mode_sentences"))
      .text(t(lang, "menu_mode_conversation"))
      .resized();

    await ctx.reply(t(lang, "welcome"), { reply_markup: keyboard });
  });

  bot.command("help", async (ctx) => {
    const lang = resolveUiLanguage(ctx);
    await ctx.reply(t(lang, "help"));
  });
}
