// Fallback TTS engine for languages Deepgram Aura can't speak (Hindi,
// Kannada). Uses the browser's built-in Web Speech API instead — quality
// depends entirely on voices installed in the user's browser/OS, but it's
// the only way to get audio out in these languages today.

const BCP47_TAG: Partial<Record<string, string>> = {
  hi: "hi-IN",
  kn: "kn-IN",
};

export function isWebSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakWithWebSpeech(
  text: string,
  language: string,
  handlers: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  },
): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = BCP47_TAG[language] ?? language;
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onError?.();
  window.speechSynthesis.speak(utterance);
  return utterance;
}
