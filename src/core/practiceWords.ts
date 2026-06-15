import type { UiLanguage } from "../config/i18n.js";

/**
 * Curated everyday European Portuguese vocabulary for "repeat after me"
 * practice. pt-PT forms only (e.g. "comboio"/"autocarro", not Brazilian).
 * Translations are stored so the prompt needs no LLM call.
 */
export interface PracticeWord {
  pt: string;
  uk: string;
  ru: string;
}

export const PRACTICE_WORDS: PracticeWord[] = [
  { pt: "bom dia", uk: "доброго ранку", ru: "доброе утро" },
  { pt: "obrigado", uk: "дякую (від чоловіка)", ru: "спасибо (от мужчины)" },
  { pt: "obrigada", uk: "дякую (від жінки)", ru: "спасибо (от женщины)" },
  { pt: "por favor", uk: "будь ласка", ru: "пожалуйста" },
  { pt: "desculpe", uk: "вибачте", ru: "извините" },
  { pt: "farmácia", uk: "аптека", ru: "аптека" },
  { pt: "médico", uk: "лікар", ru: "врач" },
  { pt: "morada", uk: "адреса", ru: "адрес" },
  { pt: "comboio", uk: "потяг", ru: "поезд" },
  { pt: "autocarro", uk: "автобус", ru: "автобус" },
  { pt: "fatura", uk: "рахунок (фактура)", ru: "счёт (фактура)" },
  { pt: "dinheiro", uk: "гроші", ru: "деньги" },
  { pt: "trabalho", uk: "робота", ru: "работа" },
  { pt: "saúde", uk: "здоров'я", ru: "здоровье" },
  { pt: "água", uk: "вода", ru: "вода" },
];

export function randomPracticeWord(): PracticeWord {
  return PRACTICE_WORDS[Math.floor(Math.random() * PRACTICE_WORDS.length)]!;
}

export function practiceTranslation(word: PracticeWord, lang: UiLanguage): string {
  return word[lang];
}
