/**
 * Per-user "current target word" for the repeat-after-me sub-mode. In-memory:
 * a target is transient practice context, so it's fine to reset on restart.
 * (Move to Supabase/sessions if persistence across restarts is ever needed.)
 */
const targets = new Map<number, string>();

export function setTarget(userId: number, word: string): void {
  targets.set(userId, word);
}

export function getTarget(userId: number): string | undefined {
  return targets.get(userId);
}

export function clearTarget(userId: number): void {
  targets.delete(userId);
}
