// Voice endpoints are binary (audio in / audio out) and intentionally bypass
// the OpenAPI/Orval codegen, so we call them directly with fetch. Same-origin
// requests send the session cookie automatically (default credentials), which
// is what the auth + subscription gates on the server rely on.

const VOICE_BASE = "/api/voice";

export class VoiceError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "VoiceError";
    this.status = status;
  }
}

async function errorFromResponse(res: Response, fallback: string): Promise<VoiceError> {
  let detail = "";
  try {
    const data = await res.json();
    detail =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.title === "string" && data.title) ||
      (typeof data?.message === "string" && data.message) ||
      "";
  } catch {
    // non-JSON body — ignore
  }
  if (res.status === 503) {
    return new VoiceError("Voice isn't set up yet. Try again later.", res.status);
  }
  return new VoiceError(detail || fallback, res.status);
}

/** Append newly-transcribed text to an existing field value with a sensible joiner. */
export function appendTranscript(existing: string | undefined, addition: string): string {
  const base = existing ?? "";
  const add = addition.trim();
  if (!add) return base;
  const joiner = base && !base.endsWith(" ") && !base.endsWith("\n") ? " " : "";
  return base + joiner + add;
}

/** Send recorded audio to the server (ElevenLabs Scribe) and get the transcript. */
export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${VOICE_BASE}/transcribe`, {
    method: "POST",
    headers: { "content-type": blob.type || "audio/webm" },
    body: blob,
    signal,
  });
  if (!res.ok) {
    throw await errorFromResponse(res, "Couldn't understand that recording. Try again.");
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/** Synthesize speech for the given text (ElevenLabs TTS) and return audio bytes. */
export async function speakText(text: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(`${VOICE_BASE}/speak`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) {
    throw await errorFromResponse(res, "Couldn't play that just now. Try again.");
  }
  return res.blob();
}
