const API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY as string | undefined;

export type VoiceLanguage = "en" | "hi" | "kn" | "es" | "fr" | "de" | "nl" | "it" | "ja";
/** "auto" lets Deepgram detect the spoken language; anything else forces it. */
export type VoiceLanguageSelection = VoiceLanguage | "auto";

// Languages Deepgram's Aura TTS can actually speak natively. Hindi and
// Kannada aren't Aura languages at all — callers should route those through
// a non-Deepgram TTS engine (see the Web Speech API fallback in TtsButton).
export const AURA_SUPPORTED_LANGUAGES: ReadonlySet<VoiceLanguage> = new Set([
  "en",
  "es",
  "fr",
  "de",
  "nl",
  "it",
  "ja",
]);

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

// Deepgram's detect_language covers 35 languages, including Hindi — but NOT
// Kannada. Codes it can return that we don't otherwise support fall back to
// English via normalizeDetectedLanguage below.
const KNOWN_DETECTABLE_LANGUAGES = new Set<VoiceLanguage>([
  "en",
  "hi",
  "es",
  "fr",
  "de",
  "nl",
  "it",
  "ja",
]);

function normalizeDetectedLanguage(code: string | undefined): VoiceLanguage {
  const short = code?.slice(0, 2).toLowerCase();
  if (short && KNOWN_DETECTABLE_LANGUAGES.has(short as VoiceLanguage)) {
    return short as VoiceLanguage;
  }
  return "en";
}

function buildSttUrl(selection: VoiceLanguageSelection): string {
  if (selection === "auto") {
    // Auto-detect: omit `language` entirely — Deepgram ignores/overrides it
    // when detect_language=true anyway, and this avoids implying a guess.
    const params = new URLSearchParams({
      model: "nova-2",
      detect_language: "true",
      smart_format: "true",
    });
    return `https://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  const { model, language: lang } = STT_CONFIG[selection];
  const params = new URLSearchParams({ model, language: lang });
  // smart_format (punctuation/casing cleanup) is only supported on
  // Deepgram's nova/enhanced models, not on Whisper.
  if (model.startsWith("nova")) params.set("smart_format", "true");
  return `https://api.deepgram.com/v1/listen?${params.toString()}`;
}

// One Aura 2 voice per language Deepgram TTS actually supports. Hindi and
// Kannada aren't in this map at all — see AURA_SUPPORTED_LANGUAGES; callers
// must route those through a different TTS engine instead of calling here.
const TTS_VOICE: Record<string, string> = {
  en: "aura-2-thalia-en",
  es: "aura-2-celeste-es",
  fr: "aura-2-agathe-fr",
  de: "aura-2-elara-de",
  nl: "aura-2-beatrix-nl",
  it: "aura-2-melia-it",
  ja: "aura-2-uzume-ja",
};

function buildTtsUrl(language: VoiceLanguage): string {
  const voice = TTS_VOICE[language];
  if (!voice) {
    throw new DeepgramRequestError(
      `Deepgram Aura has no voice for "${language}".`,
    );
  }
  return `https://api.deepgram.com/v1/speak?model=${voice}`;
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

export interface TranscriptionResult {
  transcript: string;
  /** The language that was actually used — equal to the requested one unless selection was "auto". */
  language: VoiceLanguage;
}

/** Sends recorded audio to Deepgram STT. Pass "auto" to let Deepgram detect the spoken language. */
export async function transcribeAudio(
  audio: Blob,
  mimeType: string,
  selection: VoiceLanguageSelection = "auto",
): Promise<TranscriptionResult> {
  const key = requireApiKey();

  const res = await fetch(buildSttUrl(selection), {
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
  const channel = data?.results?.channels?.[0];
  const transcript: string | undefined = channel?.alternatives?.[0]?.transcript;

  if (!transcript) {
    throw new DeepgramRequestError(
      "Couldn't hear anything. Please try again.",
    );
  }

  const language =
    selection === "auto"
      ? normalizeDetectedLanguage(channel?.detected_language)
      : selection;

  return { transcript, language };
}

/** Sends text to Deepgram TTS (Aura) and returns playable audio in the given language's voice. Only call this for languages in AURA_SUPPORTED_LANGUAGES. */
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
