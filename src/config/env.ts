import "dotenv/config";

/**
 * Centralised, validated access to environment variables.
 * Nothing else in the codebase should read process.env directly.
 */

export type ProviderMode = "stub" | "live";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

const providerMode = optional("PROVIDER_MODE", "stub") as ProviderMode;

export const env = {
  // Telegram — always required, the bot can't start without it.
  botToken: required("BOT_TOKEN"),

  // Runtime
  nodeEnv: optional("NODE_ENV", "development"),
  logLevel: optional("LOG_LEVEL", "info"),
  providerMode,

  // Supabase — required only once we actually persist data.
  // Kept optional here so the skeleton runs before a project is created.
  supabaseUrl: optional("SUPABASE_URL", ""),
  supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY", ""),

  // LLM (Gemini) — only needed in 'live' mode.
  geminiApiKey: optional("GEMINI_API_KEY", ""),
  geminiModel: optional("GEMINI_MODEL", "gemini-2.0-flash"),

  // STT (Groq Whisper) — only needed in 'live' mode.
  groqApiKey: optional("GROQ_API_KEY", ""),
  groqWhisperModel: optional("GROQ_WHISPER_MODEL", "whisper-large-v3"),

  // TTS (Piper) — local fallback.
  piperBin: optional("PIPER_BIN", "piper"),
  piperVoice: optional("PIPER_VOICE", "./voices/pt_PT-tugao-medium.onnx"),

  // TTS (Azure Neural) — preferred when configured: multiple pt-PT voices.
  azureSpeechKey: optional("AZURE_SPEECH_KEY", ""),
  azureSpeechRegion: optional("AZURE_SPEECH_REGION", "westeurope"),
  azureTtsVoice: optional("AZURE_TTS_VOICE", "pt-PT-RaquelNeural"),
} as const;

export const isStubMode = env.providerMode === "stub";
