import { useCallback, useRef, useState } from "react";
import { transcribeAudio } from "../api/deepgram";
import type { VoiceLanguage } from "../api/deepgram";

export type VoiceInputStatus = "idle" | "recording" | "transcribing" | "error";

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  language: VoiceLanguage;
}

export function useVoiceInput({ onTranscript, language }: UseVoiceInputOptions) {
  const [status, setStatus] = useState<VoiceInputStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Voice input isn't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopTracks();
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        setStatus("transcribing");
        try {
          const transcript = await transcribeAudio(
            audioBlob,
            mimeType,
            language,
          );
          onTranscript(transcript);
          setStatus("idle");
        } catch (err) {
          setStatus("error");
          setError(
            err instanceof Error ? err.message : "Transcription failed.",
          );
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      setStatus("error");
      setError("Microphone access was denied. You can continue using text input.");
      stopTracks();
    }
  }, [onTranscript, language, stopTracks]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, startRecording, stopRecording, reset };
}
