import { env } from "../config/env.js";
import type { AudioInput } from "./types.js";

/**
 * Speech-to-text. In production this is Groq Whisper (free tier in dev).
 * Pronunciation feedback = compare this transcript against the target text
 * via the LLM — that comparison lives in core, not here.
 */
export interface SttResult {
  /** The recognised text. */
  text: string;
  /** Detected/declared language code if the provider returns one. */
  language?: string;
  /** Audio duration in seconds, when available. */
  durationSec?: number;
}

export interface SttOptions {
  /**
   * Decoding hint that biases recognition toward a language/dialect and
   * expected vocabulary. Kept light (no exact target word) so pronunciation
   * errors are still transcribed honestly rather than "corrected" by the model.
   */
  prompt?: string;
}

export interface SttProvider {
  /** Transcribe a voice note to text. */
  transcribe(audio: AudioInput, options?: SttOptions): Promise<SttResult>;
}

/**
 * Fake STT for end-to-end flow testing before wiring Groq Whisper.
 * Returns a canned pt-PT word so the whole pipeline can be exercised offline.
 */
export class StubSttProvider implements SttProvider {
  async transcribe(audio: AudioInput, _options?: SttOptions): Promise<SttResult> {
    return {
      text: "obrigado",
      language: "pt",
      durationSec: Math.max(1, Math.round(audio.data.length / 16000)),
    };
  }
}

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

/**
 * Real STT via Groq's Whisper API (OpenAI-compatible transcription endpoint).
 * We force language "pt" so European Portuguese audio is transcribed as
 * Portuguese rather than guessed.
 */
export class GroqWhisperSttProvider implements SttProvider {
  constructor(
    private readonly apiKey: string = env.groqApiKey,
    private readonly model: string = env.groqWhisperModel,
  ) {}

  async transcribe(audio: AudioInput, options?: SttOptions): Promise<SttResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([audio.data], { type: audio.mimeType }),
      audio.filename ?? "audio.ogg",
    );
    form.append("model", this.model);
    form.append("language", "pt");
    form.append("response_format", "verbose_json");
    // temperature 0 = deterministic; a prompt biases toward pt-PT context.
    form.append("temperature", "0");
    if (options?.prompt) form.append("prompt", options.prompt);

    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Groq Whisper failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      text?: string;
      language?: string;
      duration?: number;
    };

    return {
      text: (data.text ?? "").trim(),
      language: data.language,
      durationSec: data.duration,
    };
  }
}
