import { existsSync } from "node:fs";
import { env } from "../config/env.js";
import { type SttProvider, StubSttProvider, GroqWhisperSttProvider } from "./stt.js";
import {
  type TtsProvider,
  StubTtsProvider,
  PiperTtsProvider,
  AzureTtsProvider,
  CachingTtsProvider,
} from "./tts.js";
import { type LlmProvider, StubLlmProvider, GeminiLlmProvider } from "./llm.js";

const azureReady = (): boolean => Boolean(env.azureSpeechKey);
/** Piper is the local fallback, live only when its voice model is on disk. */
const piperReady = (): boolean => existsSync(env.piperVoice);

function buildTts(): TtsProvider {
  // Azure (multiple pt-PT voices) preferred; Piper local fallback; else stub.
  if (azureReady()) return new CachingTtsProvider(new AzureTtsProvider());
  if (piperReady()) return new CachingTtsProvider(new PiperTtsProvider());
  return new StubTtsProvider();
}

export type { SttProvider, SttResult } from "./stt.js";
export type { TtsProvider, TtsOptions } from "./tts.js";
export type { LlmProvider, LlmCompleteOptions } from "./llm.js";
export type { AudioInput, AudioOutput } from "./types.js";

/** The three swappable providers, bundled for injection into handlers/core. */
export interface Providers {
  stt: SttProvider;
  tts: TtsProvider;
  llm: LlmProvider;
}

/**
 * Each provider goes live independently as its credentials appear, so we can
 * replace one at a time (Groq Whisper -> Gemini -> Piper) per the CLAUDE.md
 * iteration plan. A provider with no key configured falls back to its stub, so
 * the bot always runs.
 */
export function providerStatus(): Record<keyof Providers, string> {
  return {
    stt: env.groqApiKey ? "groq-whisper" : "stub",
    llm: env.geminiApiKey ? "gemini" : "stub",
    tts: azureReady() ? "azure" : piperReady() ? "piper" : "stub",
  };
}

/** Build the provider bundle from whatever credentials are configured. */
export function createProviders(): Providers {
  return {
    stt: env.groqApiKey ? new GroqWhisperSttProvider() : new StubSttProvider(),
    llm: env.geminiApiKey ? new GeminiLlmProvider() : new StubLlmProvider(),
    tts: buildTts(),
  };
}
