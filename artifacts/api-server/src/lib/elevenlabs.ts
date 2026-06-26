import { logger } from "./logger";

// ElevenLabs voice helpers: Scribe speech-to-text + text-to-speech.
// Auth is a single API key stored as the ELEVENLABS_API_KEY secret. We call the
// REST API directly (no SDK) so the surface stays small and easy to audit.

const API_BASE = "https://api.elevenlabs.io/v1";

// Kindred's default speaking voice: "River" — relaxed, neutral, calming, a good
// fit for a wellness companion. Swappable here without touching routes.
export const KINDRED_VOICE_ID = "SAz9YHcvj6GT2YYXdXww";

const TTS_MODEL = "eleven_turbo_v2_5";
const STT_MODEL = "scribe_v1";

// Bound how much text we will ever synthesize in one call (defense against cost
// blowups and oversized requests). Callers should also cap before calling.
export const MAX_TTS_CHARS = 5000;

export function isVoiceConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  return key;
}

/**
 * Transcribe an audio clip to text using ElevenLabs Scribe.
 * @param audio Raw audio bytes (e.g. webm/ogg/mp3/wav from the browser recorder).
 * @param contentType MIME type of the clip, used to name the upload.
 */
export async function transcribeAudio(
  audio: Buffer,
  contentType: string,
): Promise<string> {
  const apiKey = getApiKey();

  const ext = contentType.includes("ogg")
    ? "ogg"
    : contentType.includes("mp4") || contentType.includes("m4a")
      ? "m4a"
      : contentType.includes("mpeg") || contentType.includes("mp3")
        ? "mp3"
        : contentType.includes("wav")
          ? "wav"
          : "webm";

  const form = new FormData();
  form.append("model_id", STT_MODEL);
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: contentType || "audio/webm" }),
    `recording.${ext}`,
  );

  const res = await fetch(`${API_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error(
      { status: res.status, detail: detail.slice(0, 300) },
      "ElevenLabs speech-to-text failed",
    );
    throw new Error(`speech-to-text failed (${res.status})`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/**
 * Synthesize speech for the given text. Returns MP3 audio bytes.
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = getApiKey();
  const clipped = text.slice(0, MAX_TTS_CHARS);

  const res = await fetch(
    `${API_BASE}/text-to-speech/${KINDRED_VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: clipped,
        model_id: TTS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error(
      { status: res.status, detail: detail.slice(0, 300) },
      "ElevenLabs text-to-speech failed",
    );
    throw new Error(`text-to-speech failed (${res.status})`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}
