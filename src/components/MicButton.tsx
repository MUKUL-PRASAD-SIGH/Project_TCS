import { useEffect } from "react";
import { useVoiceInput } from "../hooks/useVoiceInput";
import type { VoiceInputStatus } from "../hooks/useVoiceInput";
import type { VoiceLanguage } from "../api/deepgram";

interface MicButtonProps {
  disabled?: boolean;
  size?: "md" | "lg";
  language: VoiceLanguage;
  onTranscript: (text: string) => void;
  onStatusChange?: (status: VoiceInputStatus, error: string | null) => void;
}

export function MicButton({
  disabled,
  size = "md",
  language,
  onTranscript,
  onStatusChange,
}: MicButtonProps) {
  const { status, error, startRecording, stopRecording, reset } =
    useVoiceInput({ onTranscript, language });

  useEffect(() => {
    onStatusChange?.(status, error);
  }, [status, error, onStatusChange]);

  function handleClick() {
    if (status === "recording") {
      stopRecording();
    } else if (status === "error") {
      reset();
    } else if (status === "idle") {
      startRecording();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || status === "transcribing"}
      aria-label={
        status === "recording" ? "Stop recording" : "Record voice message"
      }
      title={
        status === "error"
          ? (error ?? "Voice input error")
          : status === "recording"
            ? "Stop recording"
            : status === "transcribing"
              ? "Transcribing..."
              : "Speak your message"
      }
      className={`shrink-0 rounded-lg flex items-center justify-center transition-colors disabled:text-gray-300 ${
        size === "lg" ? "h-11 w-11" : "h-9 w-9"
      } ${
        status === "recording"
          ? "bg-red-500 text-white hover:bg-red-600"
          : status === "error"
            ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
            : "bg-gray-100 text-slate-600 hover:bg-gray-200"
      }`}
    >
      {status === "transcribing" ? (
        <svg
          className={`animate-spin ${size === "lg" ? "h-5 w-5" : "h-4 w-4"}`}
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
          className={size === "lg" ? "h-5 w-5" : "h-4 w-4"}
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={size === "lg" ? "h-5 w-5" : "h-4 w-4"}
        >
          <path d="M10 12.5a3 3 0 003-3v-5a3 3 0 10-6 0v5a3 3 0 003 3z" />
          <path d="M5.5 9.5a.75.75 0 00-1.5 0 6 6 0 005.25 5.955V17h-2a.75.75 0 000 1.5h5.5a.75.75 0 000-1.5h-2v-1.545A6 6 0 0016 9.5a.75.75 0 00-1.5 0 4.5 4.5 0 01-9 0z" />
        </svg>
      )}
    </button>
  );
}
