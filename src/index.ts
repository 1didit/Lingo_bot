import { createProviders, providerStatus } from "./providers/index.js";
import { createBot } from "./bot/bot.js";
import { isSupabaseConfigured } from "./db/client.js";

/**
 * Entry point. Dev runs long polling (no server needed); production will switch
 * to a webhook. Starts the bot with stub providers by default (PROVIDER_MODE).
 */
async function main(): Promise<void> {
  const providers = createProviders();
  const bot = createBot(providers);

  // Register the command list shown in the Telegram "/" menu.
  await bot.api.setMyCommands([
    { command: "start", description: "Почати / Начать" },
    { command: "practice", description: "Повтори за мною / Повтори за мной" },
    { command: "voice", description: "Голос диктора / Голос диктора" },
    { command: "help", description: "Допомога / Помощь" },
  ]);

  const status = providerStatus();
  console.log(
    `[fala-certo] starting — stt=${status.stt}, llm=${status.llm}, tts=${status.tts}, ` +
      `supabase=${isSupabaseConfigured() ? "configured" : "not configured"}`,
  );

  // Graceful shutdown on Ctrl-C / container stop.
  const stop = () => bot.stop();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await bot.start({
    onStart: (info) => console.log(`[fala-certo] @${info.username} is up (long polling)`),
  });
}

main().catch((err) => {
  console.error("[fala-certo] fatal:", err);
  process.exit(1);
});
