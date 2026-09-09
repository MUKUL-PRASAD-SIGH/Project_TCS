const API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY as string | undefined;

export type VoiceLanguage = "en" | "hi" | "kn" | "es" | "fr" | "de" | "nl" | "it" | "ja";

// Deepgram's nova-2 model has first-class support for English, Hindi, and
// the Aura-supported European/Japanese languages below. It does not
// support Kannada, so Kannada is routed through Deepgram's hosted Whisper
// model instead — broader language coverage, but lower accuracy than a
// dedicated model. This is a best-effort fallback, not a guarantee of
// quality.
const STT_CONFIG: Record<VoiceLanguage, { model: string; language: string }> =
  {
    en: { model: "nova-2", language: "en-US" },
    hi: { model: "nova-2", language: "hi" },
    kn: { model: "whisper-large", language: "kn" },
    es: { model: "nova-2", language: "es" },
    fr: { model: "nova-2", language: "fr" },
    de: { model: "nova-2", language: "de" },
    nl: { model: "nova-2", language: "nl" },
    it: { model: "nova-2", language: "it" },
    ja: { model: "nova-2", language: "ja" },
  };

function buildSttUrl(language: VoiceLanguage): string {
  const { model, language: lang } = STT_CONFIG[language];
  const params = new URLSearchParams({ model, language: lang });
  // smart_format (punctuation/casing cleanup) is only supported on
  // Deepgram's nova/enhanced models, not on Whisper.
  if (model.startsWith("nova")) params.set("smart_format", "true");
  return `https://api.deepgram.com/v1/listen?${params.toString()}`;
}

// One Aura 2 voice per language Deepgram TTS actually supports. Hindi and
// Kannada have no Aura voice at all, so they fall back to the English
// voice — TTS is never left completely broken, it just won't sound native
// for those two languages.
const TTS_VOICE: Record<VoiceLanguage, string> = {
  en: "aura-2-thalia-en",
  hi: "aura-2-thalia-en",
  kn: "aura-2-thalia-en",
  es: "aura-2-celeste-es",
  fr: "aura-2-agathe-fr",
  de: "aura-2-elara-de",
  nl: "aura-2-beatrix-nl",
  it: "aura-2-melia-it",
  ja: "aura-2-uzume-ja",
};

function buildTtsUrl(language: VoiceLanguage): string {
  return `https://api.deepgram.com/v1/speak?model=${TTS_VOICE[language]}`;
}

export class DeepgramConfigError extends Error {}
export class DeepgramRequestError extends Error {}

function requireApiKey(): string {
  if (!API_KEY) {
    throw new DeepgramConfigError(
      "Voice features are unavailable: VITE_DEEPGRAM_API_KEY is not set.",
    );
  }
  return API_KEY;
}

/** Sends recorded audio to Deepgram STT and returns the transcript. */
export async function transcribeAudio(
  audio: Blob,
  mimeType: string,
  language: VoiceLanguage = "en",
): Promise<string> {
  const key = requireApiKey();

  const res = await fetch(buildSttUrl(language), {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": mimeType,
    },
    body: audio,
  });

  if (!res.ok) {
    throw new DeepgramRequestError(
      `Speech-to-text failed (${res.status}). Please try again.`,
    );
  }

  const data = await res.json();
  const transcript: string | undefined =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  if (!transcript) {
    throw new DeepgramRequestError(
      "Couldn't hear anything. Please try again.",
    );
  }

  return transcript;
}

/** Sends text to Deepgram TTS (Aura) and returns playable audio in the given language's voice. */
export async function synthesizeSpeech(
  text: string,
  language: VoiceLanguage = "en",
): Promise<Blob> {
  const key = requireApiKey();

  const res = await fetch(buildTtsUrl(language), {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new DeepgramRequestError(
      `Text-to-speech failed (${res.status}). Please try again.`,
    );
  }

  return res.blob();
}
