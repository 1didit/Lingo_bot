import type { Providers, AudioInput } from "../providers/index.js";
import type { UiLanguage } from "../config/i18n.js";
import { buildWordEvaluationPrompt } from "./prompts.js";
import { parseLlmJson } from "./json.js";

/**
 * Mode 1 (words & stress) lesson logic. This is the orchestration layer that
 * ties providers together — it stays vendor-agnostic by depending only on the
 * provider interfaces.
 *
 * NOTE: voice plumbing (downloading the Telegram file, sending audio back) is
 * deliberately NOT wired yet. This module defines the flow so that swapping in
 * real providers later needs no handler changes.
 */

/** Structured result of evaluating a spoken pt-PT word. */
export interface WordEvaluation {
  heardWord: string;
  targetWord: string;
  translation: string;
  correctSpelling: string;
  stressPattern: string;
  isCorrect: boolean;
  feedback: string;
  grammarRule?: string;
}

/**
 * Full mode-1 flow: voice in -> STT -> LLM eval -> structured result.
 * (Persistence + TTS reply are added when the voice loop is wired.)
 */
export async function evaluateSpokenWord(
  providers: Providers,
  params: {
    audio: AudioInput;
    nativeLanguage: UiLanguage;
    targetWord?: string;
  },
): Promise<WordEvaluation> {
  // Bias Whisper toward pt-PT. In target practice we also name the expected
  // word, which sharply improves recognition of *which* word was attempted;
  // the correct/incorrect judgement is left to the LLM comparison below.
  const sttPrompt = params.targetWord?.trim()
    ? `Gravação em português europeu (pt-PT). A palavra a praticar é "${params.targetWord}".`
    : "Gravação em português europeu (pt-PT), vocabulário do dia a dia em Portugal.";
  const { text: heardWord } = await providers.stt.transcribe(params.audio, {
    prompt: sttPrompt,
  });

  const prompt = buildWordEvaluationPrompt({
    heardWord,
    targetWord: params.targetWord,
    nativeLanguage: params.nativeLanguage,
  });

  const raw = await providers.llm.complete(prompt, { json: true, temperature: 0 });
  const parsed = parseLlmJson<WordEvaluation>(raw);

  if (!parsed) {
    // Defensive fallback so a malformed LLM response never crashes a handler.
    return {
      heardWord,
      targetWord: params.targetWord ?? "",
      translation: "",
      correctSpelling: heardWord,
      stressPattern: heardWord,
      isCorrect: false,
      feedback: "",
    };
  }

  return { ...parsed, heardWord, targetWord: params.targetWord ?? parsed.targetWord };
}

/** Render a WordEvaluation as a Telegram-friendly message (native language). */
export function formatWordEvaluation(ev: WordEvaluation): string {
  const mark = ev.isCorrect ? "✅" : "❌";
  const lines = [
    `${mark} <b>${ev.correctSpelling}</b> — ${ev.translation}`,
    `🔤 ${ev.stressPattern}`,
    "",
    ev.feedback,
  ];
  if (ev.grammarRule) lines.push("", `📚 ${ev.grammarRule}`);
  return lines.filter((l) => l !== undefined).join("\n");
}
