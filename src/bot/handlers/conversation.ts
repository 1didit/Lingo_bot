import { Bot } from "grammy";
import { t } from "../../config/i18n.js";
import { resolveUiLanguage } from "../lang.js";

/**
 * Mode 3 — Conversation. Placeholder: built last, after modes 1 and 2. For now
 * the menu button just acknowledges the selection.
 */
export function registerConversationHandlers(bot: Bot): void {
  bot.hears(
    [t("uk", "menu_mode_conversation"), t("ru", "menu_mode_conversation")],
    async (ctx) => {
      const lang = resolveUiLanguage(ctx);
      await ctx.reply(t(lang, "not_implemented_yet"));
    },
  );
}
