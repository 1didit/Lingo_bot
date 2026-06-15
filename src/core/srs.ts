import type { ProgressStatus } from "../db/types.js";

/**
 * Spaced repetition — the retention engine (first-class, not optional).
 * A small SM-2-flavoured scheduler: correct answers push the next review
 * further out; wrong answers reset it to "soon".
 *
 * This is the pure scheduling math; persistence lives in src/db/queries.ts.
 */

export interface SrsState {
  status: ProgressStatus;
  ease: number;
  /** Consecutive correct repetitions. */
  reps: number;
  nextReviewAt: Date;
}

const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Compute the next SRS state from the previous one and the latest answer. */
export function scheduleNext(
  prev: Pick<SrsState, "ease" | "reps"> | null,
  wasCorrect: boolean,
  now: Date = new Date(),
): SrsState {
  const ease = prev?.ease ?? 2.5;
  const reps = prev?.reps ?? 0;

  if (!wasCorrect) {
    // Lapse: drop ease, review again within ~10 minutes.
    return {
      status: "learning",
      ease: Math.max(MIN_EASE, ease - 0.2),
      reps: 0,
      nextReviewAt: new Date(now.getTime() + 10 * 60 * 1000),
    };
  }

  const nextReps = reps + 1;
  // Interval in days: 1, 6, then geometric growth by ease.
  let intervalDays: number;
  if (nextReps === 1) intervalDays = 1;
  else if (nextReps === 2) intervalDays = 6;
  else intervalDays = Math.round((reps === 0 ? 6 : 6) * ease);

  return {
    status: nextReps >= 4 ? "mastered" : "review",
    ease: Math.min(3.0, ease + 0.1),
    reps: nextReps,
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}
