import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { env } from "../config/env.js";
import type { AudioOutput } from "./types.js";

/**
 * Text-to-speech. In production this is Piper (local, pt-PT voice), producing
 * OGG/Opus for Telegram. CPU-light: no GPU required.
 */
export interface TtsOptions {
  /** BCP-47-ish voice/language hint. Defaults to European Portuguese. */
  language?: string;
  /** Provider-specific voice id (e.g. an Azure voice like pt-PT-RaquelNeural). */
  voice?: string;
}

export interface TtsProvider {
  /** Synthesize Portuguese text into audio playable in Telegram. */
  synthesize(text: string, options?: TtsOptions): Promise<AudioOutput>;
}

/**
 * Fake TTS for end-to-end flow testing before wiring Piper.
 * Returns an empty OGG buffer — enough to exercise the "voice out" path
 * without producing real audio.
 */
export class StubTtsProvider implements TtsProvider {
  async synthesize(text: string, _options?: TtsOptions): Promise<AudioOutput> {
    return {
      data: Buffer.from(`STUB_TTS:${text}`, "utf8"),
      mimeType: "audio/ogg",
    };
  }
}

/**
 * Real TTS via local Piper (pt-PT voice). Piper streams raw 16-bit mono PCM on
 * stdout; we pipe it through ffmpeg to OGG/Opus, the format Telegram voice notes
 * use. No temp files: text -> piper -> ffmpeg -> Buffer.
 */
export class PiperTtsProvider implements TtsProvider {
  private readonly sampleRate: number;

  constructor(
    private readonly piperBin: string = env.piperBin,
    private readonly voicePath: string = env.piperVoice,
  ) {
    this.sampleRate = PiperTtsProvider.readSampleRate(voicePath);
  }

  private static readSampleRate(voicePath: string): number {
    try {
      const cfg = JSON.parse(readFileSync(`${voicePath}.json`, "utf8"));
      return cfg?.audio?.sample_rate ?? 22050;
    } catch {
      return 22050;
    }
  }

  async synthesize(text: string, _options?: TtsOptions): Promise<AudioOutput> {
    const data = await this.run(text);
    return { data, mimeType: "audio/ogg" };
  }

  private run(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const piper = spawn(this.piperBin, ["-m", this.voicePath, "--output-raw"]);
      const ffmpeg = spawn("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-f", "s16le", "-ar", String(this.sampleRate), "-ac", "1", "-i", "-",
        "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", "pipe:1",
      ]);

      const out: Buffer[] = [];
      const errs: string[] = [];

      ffmpeg.stdout.on("data", (c: Buffer) => out.push(c));
      piper.stderr.on("data", (c: Buffer) => errs.push(`piper: ${c}`));
      ffmpeg.stderr.on("data", (c: Buffer) => errs.push(`ffmpeg: ${c}`));

      piper.on("error", (e) => reject(new Error(`piper spawn failed: ${e.message}`)));
      ffmpeg.on("error", (e) => reject(new Error(`ffmpeg spawn failed: ${e.message}`)));

      piper.stdout.pipe(ffmpeg.stdin);

      ffmpeg.on("close", (code) => {
        if (code === 0) resolve(Buffer.concat(out));
        else reject(new Error(`Piper/ffmpeg TTS failed (ffmpeg exit ${code}): ${errs.join("")}`));
      });

      piper.stdin.write(text);
      piper.stdin.end();
    });
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Real TTS via Azure Neural (Cognitive Services Speech). Returns OGG/Opus
 * directly (no ffmpeg needed). Multiple pt-PT voices are available — the voice
 * is chosen per request via TtsOptions.voice, falling back to AZURE_TTS_VOICE.
 */
export class AzureTtsProvider implements TtsProvider {
  constructor(
    private readonly key: string = env.azureSpeechKey,
    private readonly region: string = env.azureSpeechRegion,
    private readonly defaultVoice: string = env.azureTtsVoice,
  ) {}

  async synthesize(text: string, options?: TtsOptions): Promise<AudioOutput> {
    const voice = options?.voice ?? this.defaultVoice;
    const ssml =
      `<speak version='1.0' xml:lang='pt-PT'>` +
      `<voice name='${voice}'>${escapeXml(text)}</voice></speak>`;

    const res = await fetch(
      `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "ogg-48khz-16bit-mono-opus",
          "User-Agent": "fala-certo",
        },
        body: ssml,
      },
    );

    if (!res.ok) {
      throw new Error(`Azure TTS failed (${res.status}): ${await res.text()}`);
    }

    return {
      data: Buffer.from(await res.arrayBuffer()),
      mimeType: "audio/ogg",
    };
  }
}

/**
 * Disk-cache decorator for any TtsProvider. Keyed by (voice + text), so each
 * distinct phrase per voice is synthesized once and reused — this keeps Azure
 * character usage tiny for a vocabulary-based bot.
 */
export class CachingTtsProvider implements TtsProvider {
  constructor(
    private readonly inner: TtsProvider,
    private readonly dir: string = "cache/tts",
  ) {}

  async synthesize(text: string, options?: TtsOptions): Promise<AudioOutput> {
    const voice = options?.voice ?? "default";
    const key = createHash("sha1").update(`${voice}|${text}`).digest("hex");
    const file = join(this.dir, `${key}.ogg`);

    if (existsSync(file)) {
      return { data: readFileSync(file), mimeType: "audio/ogg" };
    }

    const out = await this.inner.synthesize(text, options);
    try {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(file, out.data);
    } catch {
      // Cache write is best-effort; never fail synthesis over it.
    }
    return out;
  }
}
