import { Bot } from "grammy";
import { t } from "../../config/i18n.js";
import { resolveUiLanguage } from "../lang.js";

/**
 * Mode 2 — Sentence building. Placeholder: built after the mode-1 voice loop
 * works end-to-end. For now the menu button just acknowledges the selection.
 */
export function registerSentencesHandlers(bot: Bot): void {
  bot.hears(
    [t("uk", "menu_mode_sentences"), t("ru", "menu_mode_sentences")],
    async (ctx) => {
      const lang = resolveUiLanguage(ctx);
      await ctx.reply(t(lang, "not_implemented_yet"));
    },
  );
}
