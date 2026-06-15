import { getSupabase, isSupabaseConfigured } from "./client.js";
import { scheduleNext } from "../core/srs.js";
import type { CefrLevel, ProgressStatus, UserRow } from "./types.js";

/**
 * Thin query helpers. Bot handlers and core call these — never the Supabase
 * client directly — so storage stays swappable and easy to mock.
 *
 * These are intentionally minimal for the skeleton; SRS reads/writes and
 * vocabulary persistence are added when mode 1 is wired end-to-end.
 */

/**
 * Insert the user on first contact, or return the existing row.
 * No-op-safe: returns null when Supabase isn't configured yet, so /start works
 * before the database exists.
 */
export async function upsertUser(params: {
  telegramId: number;
  nativeLanguage: string;
  level?: CefrLevel;
}): Promise<UserRow | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        telegram_id: params.telegramId,
        native_language: params.nativeLanguage,
        level: params.level ?? "A1",
      },
      { onConflict: "telegram_id", ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error) throw error;
  return data as UserRow;
}

export async function getUserByTelegramId(
  telegramId: number,
): Promise<UserRow | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select()
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) throw error;
  return (data as UserRow | null) ?? null;
}

/** Persist the user's chosen narrator voice (creates the user row if needed). */
export async function setUserVoice(
  telegramId: number,
  voiceId: string,
  nativeLanguage: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabase();
  const { error } = await supabase.from("users").upsert(
    {
      telegram_id: telegramId,
      native_language: nativeLanguage,
      voice_id: voiceId,
    },
    { onConflict: "telegram_id" },
  );
  if (error) throw error;
}

/** Insert/return a vocabulary item, returning its id. */
export async function upsertVocabulary(item: {
  wordPt: string;
  translation: string;
  stressPattern?: string | null;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vocabulary")
    .upsert(
      {
        word_pt: item.wordPt,
        translation: item.translation,
        stress_pattern: item.stressPattern ?? null,
      },
      { onConflict: "word_pt,translation" },
    )
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

// The progress table stores ease/status but not the raw repetition count, so we
// approximate "reps" from status to feed the SRS scheduler. Precise rep storage
// is a future refinement.
const STATUS_TO_REPS: Record<ProgressStatus, number> = {
  new: 0,
  learning: 0,
  review: 2,
  mastered: 4,
};

/** Record one practice attempt and reschedule the item via SRS. */
export async function recordAttempt(params: {
  userId: string;
  itemId: string;
  wasCorrect: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("progress")
    .select("ease,status")
    .eq("user_id", params.userId)
    .eq("item_id", params.itemId)
    .maybeSingle();

  const prev = existing
    ? {
        ease: (existing as { ease: number }).ease,
        reps: STATUS_TO_REPS[(existing as { status: ProgressStatus }).status],
      }
    : null;

  const next = scheduleNext(prev, params.wasCorrect);

  const { error } = await supabase.from("progress").upsert(
    {
      user_id: params.userId,
      item_id: params.itemId,
      status: next.status,
      ease: next.ease,
      next_review_at: next.nextReviewAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id" },
  );

  if (error) throw error;
}
