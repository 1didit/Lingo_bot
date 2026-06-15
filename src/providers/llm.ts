import { env } from "../config/env.js";

/**
 * Large language model. In production this is Google Gemini (Flash).
 * Used for translation, grammar correction and error analysis. Always prompt
 * for European Portuguese (pt-PT) explicitly — never Brazilian forms.
 *
 * The interface stays deliberately thin: prompt in, text out. Prompt building
 * and JSON parsing live in src/core, so the vendor wrapper has no domain logic.
 */
export interface LlmCompleteOptions {
  /** 0 = deterministic, higher = more creative. */
  temperature?: number;
  /** Ask the model to return strict JSON (provider sets the right flag). */
  json?: boolean;
}

export interface LlmProvider {
  /** Run a single completion and return the model's raw text response. */
  complete(prompt: string, options?: LlmCompleteOptions): Promise<string>;
}

/**
 * Fake LLM for end-to-end flow testing before wiring Gemini.
 *
 * For now it returns a canned word-evaluation JSON (mode 1 shape) regardless of
 * the prompt, so the full pipeline — STT -> LLM eval -> reply — can be tested
 * offline. Swap in GeminiLlmProvider later without touching callers.
 */
export class StubLlmProvider implements LlmProvider {
  async complete(_prompt: string, options?: LlmCompleteOptions): Promise<string> {
    const cannedEvaluation = {
      heardWord: "obrigado",
      targetWord: "obrigado",
      translation: "дякую",
      correctSpelling: "obrigado",
      stressPattern: "o-bri-GA-do",
      isCorrect: true,
      feedback:
        "(STUB) Вимова правильна. Наголос падає на третій склад: o-bri-GA-do.",
      grammarRule:
        "(STUB) Чоловіки кажуть «obrigado», жінки — «obrigada» (узгодження за родом мовця).",
    };

    if (options?.json) {
      return JSON.stringify(cannedEvaluation);
    }
    return cannedEvaluation.feedback;
  }
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Real LLM via Google Gemini (generativelanguage REST API). When `json` is set
 * we ask for `responseMimeType: application/json` so the model returns strict
 * JSON with no markdown fences.
 */
// Free-tier quota is per model per day, so when one model is exhausted we fall
// back to others that each have their own bucket — keeping the bot working.
const GEMINI_FALLBACKS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

export class GeminiLlmProvider implements LlmProvider {
  private readonly models: string[];

  constructor(
    private readonly apiKey: string = env.geminiApiKey,
    model: string = env.geminiModel,
  ) {
    this.models = [...new Set([model, ...GEMINI_FALLBACKS])];
  }

  async complete(prompt: string, options?: LlmCompleteOptions): Promise<string> {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        ...(options?.json ? { responseMimeType: "application/json" } : {}),
      },
    };

    let lastError = "";
    for (const model of this.models) {
      const result = await this.tryModel(model, body);
      if (result.text !== null) return result.text;
      lastError = result.error;
      // Switch to the next model only on quota/rate limits; otherwise stop.
      if (!result.rateLimited) break;
    }
    throw new Error(`Gemini failed (${lastError})`);
  }

  private async tryModel(
    model: string,
    body: unknown,
  ): Promise<{ text: string | null; error: string; rateLimited: boolean }> {
    // Retry a transient 503 once; treat 429 as "this model is out, move on".
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = (data.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text ?? "")
          .join("");
        return { text, error: "", rateLimited: false };
      }

      const error = `${model} ${res.status}: ${(await res.text()).slice(0, 160)}`;
      if (res.status === 429) return { text: null, error, rateLimited: true };
      if (res.status === 503 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      return { text: null, error, rateLimited: false };
    }
    return { text: null, error: `${model}: exhausted retries`, rateLimited: false };
  }
}
