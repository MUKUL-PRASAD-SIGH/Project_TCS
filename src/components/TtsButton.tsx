import { useEffect, useRef, useState } from "react";
import { AURA_SUPPORTED_LANGUAGES, synthesizeSpeech } from "../api/deepgram";
import type { VoiceLanguage } from "../api/deepgram";
import { isWebSpeechSupported, speakWithWebSpeech } from "../api/webSpeechTts";

interface TtsButtonProps {
  text: string;
  language?: VoiceLanguage;
  /** Start speaking as soon as this button mounts (used for freshly generated AI replies). */
  autoPlay?: boolean;
}

type TtsStatus = "idle" | "loading" | "ready" | "error";

export function TtsButton({ text, language = "en", autoPlay = false }: TtsButtonProps) {
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Synchronous re-entrancy guard: React state updates are async, so a
  // second click during the fetch/loading window could otherwise slip past
  // a `status === "loading"` check and kick off a second, competing fetch.
  const busyRef = useRef(false);
  const usesAura = AURA_SUPPORTED_LANGUAGES.has(language);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function startFresh() {
    busyRef.current = true;
    setErrorMessage(null);

    if (usesAura) {
      setStatus("loading");
      try {
        const blob = await synthesizeSpeech(text, language);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audio.onplay = () => setIsPlaying(true);
        audio.onpause = () => setIsPlaying(false);
        audio.onended = () => {
          setIsPlaying(false);
          // Reset position (don't drop the element) so the next click
          // replays from the start instead of doing nothing.
          audio.currentTime = 0;
        };
        audioRef.current = audio;
        setStatus("ready");
        try {
          await audio.play();
        } catch {
          // Autoplay blocked by the browser (no user gesture yet) — the
          // audio is fetched and ready, the user just needs to press Play.
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Playback failed.",
        );
      } finally {
        busyRef.current = false;
      }
      return;
    }

    // Aura has no voice for this language (Hindi/Kannada) — speak it
    // through the browser's own Web Speech API instead.
    if (!isWebSpeechSupported()) {
      setStatus("error");
      setErrorMessage("Spoken playback isn't supported in this browser.");
      busyRef.current = false;
      return;
    }
    utteranceRef.current = speakWithWebSpeech(text, language, {
      onStart: () => {
        setStatus("ready");
        setIsPlaying(true);
      },
      onEnd: () => {
        setIsPlaying(false);
        // SpeechSynthesisUtterance objects are single-use per spec — clear
        // it so the next click creates a fresh one instead of doing nothing.
        utteranceRef.current = null;
      },
      onError: () => {
        setStatus("error");
        setErrorMessage("Playback failed.");
        utteranceRef.current = null;
      },
    });
    busyRef.current = false;
  }

  function handleClick() {
    if (status === "loading" || busyRef.current) return;

    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      else if (utteranceRef.current) window.speechSynthesis.pause();
      return;
    }

    if (audioRef.current) {
      if (audioRef.current.ended) audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }
    if (utteranceRef.current) {
      // A still-live (paused, not ended) utterance — resume it in place.
      window.speechSynthesis.resume();
      return;
    }

    void startFresh();
  }

  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (autoPlay && !autoPlayedRef.current) {
      autoPlayedRef.current = true;
      void startFresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "loading"}
      aria-label={isPlaying ? "Pause audio" : "Play audio"}
      title={
        status === "error"
          ? (errorMessage ?? "Couldn't play audio. Please try again.")
          : isPlaying
            ? "Pause audio"
            : "Play audio"
      }
      className={`inline-flex items-center gap-1 mt-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${
        status === "error"
          ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
          : "text-slate-500 bg-white border border-gray-200 hover:border-gray-300 hover:text-slate-700"
      }`}
    >
      {status === "loading" ? (
        <svg
          className="h-3 w-3 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : status === "error" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3 w-3"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      ) : isPlaying ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3 w-3"
        >
          <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h2a.75.75 0 00.75-.75V3.75A.75.75 0 007.75 3h-2zm6.5 0a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h2a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-2z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3 w-3"
        >
          <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
        </svg>
      )}
      {status === "error" ? "Play failed" : isPlaying ? "Pause" : "Play audio"}
    </button>
  );
}
