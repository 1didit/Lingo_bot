/**
 * Row types mirroring the Supabase schema in src/db/schema.sql.
 * Keep these in sync with the SQL migration.
 */

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/** Spaced-repetition status for a vocabulary item. */
export type ProgressStatus = "new" | "learning" | "review" | "mastered";

export type LearningMode = "words" | "sentences" | "conversation";

export interface UserRow {
  id: string; // uuid
  telegram_id: number;
  native_language: string; // "uk" | "ru" (UI language pack code)
  level: CefrLevel;
  voice_id: string | null; // chosen TTS voice (e.g. pt-PT-RaquelNeural)
  created_at: string; // ISO timestamp
}

export interface VocabularyRow {
  id: string; // uuid
  word_pt: string;
  translation: string;
  stress_pattern: string | null;
  audio_ref: string | null;
  created_at: string;
}

export interface ProgressRow {
  id: string; // uuid
  user_id: string;
  item_id: string; // -> vocabulary.id
  status: ProgressStatus;
  ease: number; // SRS ease factor
  next_review_at: string | null;
  updated_at: string;
}

export interface SessionRow {
  id: string; // uuid
  user_id: string;
  mode: LearningMode;
  started_at: string;
}
