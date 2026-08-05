import express, { Router, type IRouter } from "express";
import {
  transcribeAudio,
  synthesizeSpeech,
  isVoiceConfigured,
  MAX_TTS_CHARS,
} from "../lib/elevenlabs";

// Voice endpoints are binary media proxies (audio in / audio out), so they are
// implemented as direct Express routes rather than going through the
// contract-first OpenAPI codegen (which targets JSON request/response shapes).
// The frontend calls these with fetch. They are mounted after requireAuth in
// routes/index.ts, so callers are always authenticated users.

const router: IRouter = Router();

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB cap on uploaded clips

// POST /voice/transcribe — accepts a raw audio clip, returns { text }.
router.post(
  "/voice/transcribe",
  express.raw({ type: () => true, limit: MAX_AUDIO_BYTES }),
  async (req, res): Promise<void> => {
    if (!isVoiceConfigured()) {
      res.status(503).json({ error: "Voice features are not configured" });
      return;
    }

    const audio = req.body as unknown;
    if (!Buffer.isBuffer(audio) || audio.length === 0) {
      res.status(400).json({ error: "No audio provided" });
      return;
    }
    if (audio.length > MAX_AUDIO_BYTES) {
      res.status(413).json({ error: "Audio clip too large" });
      return;
    }

    const contentType = req.headers["content-type"] || "audio/webm";

    try {
      const text = await transcribeAudio(audio, contentType);
      res.json({ text });
    } catch (err) {
      req.log.error({ err }, "voice transcribe failed");
      res.status(502).json({ error: "Transcription failed" });
    }
  },
);

// POST /voice/speak — accepts { text }, returns audio/mpeg bytes.
router.post("/voice/speak", async (req, res): Promise<void> => {
  if (!isVoiceConfigured()) {
    res.status(503).json({ error: "Voice features are not configured" });
    return;
  }

  const text = (req.body as { text?: unknown })?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "No text provided" });
    return;
  }
  if (text.length > MAX_TTS_CHARS) {
    res.status(413).json({ error: "Text too long" });
    return;
  }

  try {
    const audio = await synthesizeSpeech(text);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch (err) {
    req.log.error({ err }, "voice speak failed");
    res.status(502).json({ error: "Speech synthesis failed" });
  }
});

export default router;
