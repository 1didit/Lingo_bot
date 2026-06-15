import type { UiLanguage } from "../config/i18n.js";

/**
 * Prompt builders. Centralised so every LLM call enforces the same rules:
 * European Portuguese only (pt-PT, never Brazilian) and strict JSON output.
 *
 * Handlers never build prompts inline — they call these.
 */

const NATIVE_LANGUAGE_NAME: Record<UiLanguage, string> = {
  uk: "Ukrainian",
  ru: "Russian",
};

/**
 * Mode 1 (words & stress): compare what STT heard against the target word and
 * return a structured evaluation in the user's native language.
 *
 * `targetWord` may be empty in free practice — then the model judges the heard
 * word on its own (translation + stress + correctness of the user's attempt).
 */
export function buildWordEvaluationPrompt(params: {
  heardWord: string;
  targetWord?: string;
  nativeLanguage: UiLanguage;
}): string {
  const native = NATIVE_LANGUAGE_NAME[params.nativeLanguage];
  const target = params.targetWord?.trim()
    ? `The target word the user was asked to say is "${params.targetWord}".`
    : "There is no fixed target word; evaluate the word the user actually said.";

  return [
    "You are a European Portuguese (pt-PT) pronunciation and spelling coach.",
    "Use ONLY European Portuguese forms, vocabulary and spelling. Never Brazilian.",
    "",
    `A learner sent a voice note. Speech-to-text heard: "${params.heardWord}".`,
    target,
    "",
    `Explain feedback in ${native}. Mark stress with capitals on the stressed`,
    'syllable, e.g. "o-bri-GA-do". Always include the underlying grammar rule.',
    "",
    "Respond with STRICT JSON only (no markdown, no prose) in this exact shape:",
    "{",
    '  "heardWord": string,        // what STT heard',
    '  "targetWord": string,       // expected pt-PT word ("" if none)',
    '  "translation": string,      // meaning in the learner\'s native language',
    '  "correctSpelling": string,  // correct pt-PT spelling',
    '  "stressPattern": string,    // syllables with stressed one in CAPS',
    '  "isCorrect": boolean,       // did the learner say it correctly?',
    `  "feedback": string,         // short explanation in ${native}`,
    `  "grammarRule": string       // the rule behind it, in ${native}`,
    "}",
  ].join("\n");
}
