/**
 * Catalogue of selectable TTS narrator voices (European Portuguese).
 * IDs are Azure Neural voice ShortNames, confirmed against the voices/list API.
 * Gender is shown with a neutral emoji so the label needs no translation.
 */
export interface VoiceOption {
  /** Azure voice ShortName, e.g. "pt-PT-RaquelNeural". */
  id: string;
  /** Display name. */
  name: string;
  gender: "female" | "male";
}

export const PT_VOICES: VoiceOption[] = [
  { id: "pt-PT-RaquelNeural", name: "Raquel", gender: "female" },
  { id: "pt-PT-FernandaNeural", name: "Fernanda", gender: "female" },
  { id: "pt-PT-DuarteNeural", name: "Duarte", gender: "male" },
];

export const DEFAULT_VOICE_ID = "pt-PT-RaquelNeural";

export function isKnownVoice(id: string): boolean {
  return PT_VOICES.some((v) => v.id === id);
}

export function findVoice(id: string): VoiceOption | undefined {
  return PT_VOICES.find((v) => v.id === id);
}

/** Button/label text like "Raquel 👩". */
export function voiceLabel(v: VoiceOption): string {
  return `${v.name} ${v.gender === "female" ? "👩" : "👨"}`;
}
