import { Bot } from "grammy";
import { env } from "../config/env.js";
import type { Providers } from "../providers/index.js";
import { registerStartHandlers } from "./handlers/start.js";
import { registerVoiceHandlers } from "./handlers/voice.js";
import { registerPracticeHandlers } from "./handlers/practice.js";
import { registerWordsHandlers } from "./handlers/words.js";
import { registerSentencesHandlers } from "./handlers/sentences.js";
import { registerConversationHandlers } from "./handlers/conversation.js";

/**
 * Build the grammY bot and register every handler. Providers are injected so
 * handlers stay vendor-agnostic and the bot is easy to test with stubs.
 */
export function createBot(providers: Providers): Bot {
  const bot = new Bot(env.botToken);

  // Default parse mode for the rich correction messages (mode 1 uses <b>…</b>).
  bot.api.config.use((prev, method, payload, signal) =>
    prev(
      method,
      "text" in payload && !("parse_mode" in payload)
        ? { parse_mode: "HTML", ...payload }
        : payload,
      signal,
    ),
  );

  registerStartHandlers(bot);
  registerVoiceHandlers(bot, providers);
  registerPracticeHandlers(bot);
  registerWordsHandlers(bot, providers);
  registerSentencesHandlers(bot);
  registerConversationHandlers(bot);

  bot.catch((err) => {
    console.error(`Error handling update ${err.ctx.update.update_id}:`, err.error);
  });

  return bot;
}
