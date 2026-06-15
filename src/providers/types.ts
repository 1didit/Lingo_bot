/**
 * Shared domain types used across the swappable provider interfaces.
 *
 * Architecture rule (see CLAUDE.md): STT, TTS and LLM are wrapped behind small
 * interfaces. A vendor must be changeable in ONE place — never call a vendor SDK
 * directly from a bot handler. Handlers and core logic depend only on the
 * interfaces declared here and in stt.ts / tts.ts / llm.ts.
 */

/** Raw audio payload (e.g. a Telegram voice note, OGG/Opus). */
export interface AudioInput {
  data: Buffer;
  /** MIME type, e.g. "audio/ogg" for Telegram voice. */
  mimeType: string;
  /** Optional original filename, helps some STT APIs sniff the format. */
  filename?: string;
}

/** Synthesised audio ready to be sent back to Telegram. */
export interface AudioOutput {
  data: Buffer;
  /** MIME type of the produced audio, e.g. "audio/ogg". */
  mimeType: string;
}
