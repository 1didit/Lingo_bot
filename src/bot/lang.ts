import type { Context } from "grammy";
import { DEFAULT_LANGUAGE, isSupportedLanguage, type UiLanguage } from "../config/i18n.js";

/**
 * Resolve the UI language for an update. For the skeleton we infer it from the
 * Telegram client locale; once users pick a language at /start it will come
 * from the `users` table instead.
 */
export function resolveUiLanguage(ctx: Context): UiLanguage {
  const code = ctx.from?.language_code?.slice(0, 2).toLowerCase() ?? "";
  if (isSupportedLanguage(code)) return code;
  // Russian-speakers may report other CIS locales; default everything else to uk.
  return code === "ru" ? "ru" : DEFAULT_LANGUAGE;
}
