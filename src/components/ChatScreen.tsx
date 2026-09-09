import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { ChatMessage, PermitDetails } from "../types";
import {
  deriveDocuments,
  deriveRequirements,
  describePermit,
  getPermitById,
} from "../data/permitRules";
import type { RawPermit } from "../data/permitRules";
import { askGemini } from "../api/gemini";
import type { DemoOverride, GeminiTurn } from "../api/gemini";
import { ProgressPanel } from "./ProgressPanel";
import { ResultCard } from "./ResultCard";
import { TypingIndicator } from "./TypingIndicator";
import { MicButton } from "./MicButton";
import { TtsButton } from "./TtsButton";
import { LanguageSelect } from "./LanguageSelect";
import type { VoiceInputStatus } from "../hooks/useVoiceInput";
import type { VoiceLanguage, VoiceLanguageSelection } from "../api/deepgram";

interface ChatScreenProps {
  initialInput: string;
  /** Language detected on the landing page, if the user spoke their initial request. */
  initialLanguage: VoiceLanguage | null;
  demoOverride: DemoOverride;
  onStartOver: () => void;
}

function buildPermitDetails(raw: RawPermit): PermitDetails {
  return {
    id: raw.permit_id,
    name: raw.permit_name,
    description: describePermit(raw),
    requirements: deriveRequirements(raw).map((r) => ({
      ...r,
      status: "pending" as const,
    })),
    documents: deriveDocuments(raw).map((d) => ({
      ...d,
      status: "missing" as const,
    })),
  };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg_${idCounter}`;
}

export function ChatScreen({
  initialInput,
  initialLanguage,
  demoOverride,
  onStartOver,
}: ChatScreenProps) {
  const [permit, setPermit] = useState<PermitDetails | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId(), sender: "user", text: initialInput },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finalEligibility, setFinalEligibility] = useState(false);
  const [resultSummary, setResultSummary] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [progressOpen, setProgressOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceInputStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micSelection, setMicSelection] =
    useState<VoiceLanguageSelection>("auto");
  // The language this conversation is "locked" to once detected — persists
  // for the rest of the chat so replies stay consistent even if a later
  // utterance is mis-detected. Manually picking a language always
  // overrides it immediately; picking "Auto-detect" again unlocks it.
  const [sessionLanguage, setSessionLanguage] = useState<VoiceLanguage | null>(
    initialLanguage,
  );
  const [uploadingFileNames, setUploadingFileNames] = useState<
    string[] | null
  >(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Source of truth sent to Gemini — kept in refs (not state) so an
  // in-flight async call always reads the latest value, never a stale one
  // captured at render time.
  const matchedPermitRef = useRef<RawPermit | null>(null);
  const confirmedIdsRef = useRef<string[]>([]);
  const geminiHistoryRef = useRef<GeminiTurn[]>([]);
  // Guards against React StrictMode's double-invoke of mount effects in
  // dev, which would otherwise fire two real Gemini calls for one session.
  const hasStartedRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping, showResult, uploadingFileNames, chatError]);

  const inputDisabled = isTyping || showResult;

  async function runTurn(userTextForGemini: string) {
    setIsTyping(true);
    setChatError(null);

    try {
      const result = await askGemini({
        history: geminiHistoryRef.current,
        newUserText: userTextForGemini,
        sessionLanguage: sessionLanguage ?? "en",
        matchedPermit: matchedPermitRef.current,
        confirmedIds: confirmedIdsRef.current,
        demoOverride,
      });

      geminiHistoryRef.current = [
        ...geminiHistoryRef.current,
        { role: "user", text: userTextForGemini },
        { role: "model", text: result.reply_message },
      ];

      let currentPermit = permit;

      if (!matchedPermitRef.current && result.matched_permit_id) {
        const raw = getPermitById(result.matched_permit_id);
        if (raw) {
          matchedPermitRef.current = raw;
          currentPermit = buildPermitDetails(raw);
        }
      }

      if (currentPermit && result.newly_satisfied_requirements.length > 0) {
        const satisfied = new Set(result.newly_satisfied_requirements);
        currentPermit = {
          ...currentPermit,
          requirements: currentPermit.requirements.map((r) =>
            satisfied.has(r.id) ? { ...r, status: "met" as const } : r,
          ),
          documents: currentPermit.documents.map((d) =>
            satisfied.has(d.id) ? { ...d, status: "have" as const } : d,
          ),
        };
        confirmedIdsRef.current = [
          ...confirmedIdsRef.current,
          ...result.newly_satisfied_requirements,
        ];
      }

      if (result.is_evaluation_complete && currentPermit) {
        if (result.final_eligibility === false) {
          currentPermit = {
            ...currentPermit,
            requirements: currentPermit.requirements.map((r) =>
              r.status === "pending" ? { ...r, status: "failed" as const } : r,
            ),
          };
        }
        setFinalEligibility(result.final_eligibility ?? false);
        setResultSummary(result.reply_message);
        setShowResult(true);
      }

      if (currentPermit) setPermit(currentPermit);

      const lang = sessionLanguage ?? "en";
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          sender: "ai",
          text: result.reply_message,
          language: lang,
          autoPlay: true,
        },
      ]);
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsTyping(false);
    }
  }

  // Kick off the conversation with the user's initial request.
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    void runTurn(initialInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLanguageChange(selection: VoiceLanguageSelection) {
    setMicSelection(selection);
    // Manual pick wins immediately; re-selecting "Auto-detect" unlocks the
    // session language so the next utterance can set it again.
    setSessionLanguage(selection === "auto" ? null : selection);
  }

  function handleTranscript(text: string, language: VoiceLanguage) {
    setInputValue(text);
    setSessionLanguage((prev) => prev ?? language);
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || inputDisabled) return;

    setMessages((prev) => [
      ...prev,
      { id: nextId(), sender: "user", text: trimmed },
    ]);
    setInputValue("");
    void runTurn(trimmed);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file(s) later
    if (files.length === 0) return;

    const fileNames = files.map((f) => f.name);
    setUploadingFileNames(fileNames);
    setTimeout(() => {
      setUploadingFileNames(null);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          sender: "user",
          text: fileNames.join(", "),
          fileNames,
        },
      ]);
      // Hidden from the visible chat — Gemini needs to know a file arrived,
      // the user just sees the file-chip bubble above, not this note.
      const systemNote = `SYSTEM_NOTE: The user just uploaded ${files.length} file${
        files.length === 1 ? "" : "s"
      }: ${fileNames.join(", ")}.`;
      void runTurn(systemNote);
    }, 1000);
  }

  const resolvedCount =
    permit?.requirements.filter((r) => r.status !== "pending").length ?? 0;
  const totalCount = permit?.requirements.length ?? 0;
  const progress = showResult
    ? 100
    : totalCount > 0
      ? Math.round((resolvedCount / totalCount) * 100)
      : 0;

  const uploadDisabled = isTyping || uploadingFileNames !== null;

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
            MP
          </div>
          <span className="font-medium text-slate-900 text-sm">
            Municipal Permit Assistant
          </span>
        </div>
        <button
          onClick={onStartOver}
          type="button"
          className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          Start Over
        </button>
      </header>

      {/* Mobile sticky progress summary */}
      <button
        type="button"
        onClick={() => setProgressOpen((v) => !v)}
        className="md:hidden shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-slate-500">
            Application Progress
          </span>
          <span className="text-xs font-semibold text-slate-900">
            {progress}%
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 text-slate-400 transition-transform ${progressOpen ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div className="flex-1 min-h-0 flex relative">
        {/* Mobile drawer overlay */}
        {progressOpen && (
          <div className="md:hidden absolute inset-0 z-20 flex flex-col">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setProgressOpen(false)}
            />
            <div className="relative bg-white border-b border-gray-200 shadow-lg max-h-[75vh] overflow-y-auto p-5">
              {permit ? (
                <ProgressPanel permit={permit} progress={progress} />
              ) : (
                <p className="text-sm text-slate-400">
                  Figuring out which permit applies to you…
                </p>
              )}
            </div>
          </div>
        )}

        {/* Chat column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-6"
          >
            <div className="max-w-2xl mx-auto flex flex-col gap-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      msg.sender === "user"
                        ? "max-w-[85%] flex flex-col rounded-2xl rounded-br-sm bg-slate-900 text-white px-4 py-2.5 text-sm"
                        : "max-w-[85%] flex flex-col items-start rounded-2xl rounded-bl-sm bg-gray-100 text-slate-800 px-4 py-2.5 text-sm"
                    }
                  >
                    {msg.fileNames ? (
                      <span className="flex flex-col gap-1.5">
                        {msg.fileNames.map((name) => (
                          <span
                            key={name}
                            className="flex items-center gap-2"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4 shrink-0"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 3.75A2.75 2.75 0 016.75 1h4.836c.729 0 1.428.29 1.944.805l3.164 3.164c.516.516.805 1.215.805 1.944V16.25A2.75 2.75 0 0114.75 19h-8a2.75 2.75 0 01-2.75-2.75V3.75zM6.75 2.5c-.69 0-1.25.56-1.25 1.25v12.5c0 .69.56 1.25 1.25 1.25h8c.69 0 1.25-.56 1.25-1.25V7.5h-3.75A1.75 1.75 0 0110.5 5.75V2.5H6.75z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      msg.text
                    )}
                    {msg.sender === "ai" && (
                      <TtsButton
                        text={msg.text}
                        language={msg.language}
                        autoPlay={msg.autoPlay}
                      />
                    )}
                  </div>
                </div>
              ))}
              {uploadingFileNames && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] flex items-center gap-2 rounded-2xl rounded-br-sm bg-slate-100 text-slate-500 px-4 py-2.5 text-sm">
                    <svg
                      className="h-3.5 w-3.5 animate-spin shrink-0"
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
                    {uploadingFileNames.length === 1
                      ? `Uploading ${uploadingFileNames[0]}...`
                      : `Uploading ${uploadingFileNames.length} files...`}
                  </div>
                </div>
              )}
              {isTyping && (
                <div className="flex justify-start">
                  <TypingIndicator />
                </div>
              )}
              {chatError && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 text-sm">
                    {chatError}
                  </div>
                </div>
              )}
              {showResult && permit && (
                <div className="pt-2">
                  <ResultCard
                    isEligible={finalEligibility}
                    summaryMessage={resultSummary}
                    permit={permit}
                    onStartOver={onStartOver}
                  />
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSend}
            className="shrink-0 border-t border-gray-200 px-4 sm:px-6 py-4"
          >
            <div className="max-w-2xl mx-auto flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 transition-shadow">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadDisabled}
                aria-label="Attach a document"
                title="Attach a document"
                className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:hover:bg-gray-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={inputDisabled}
                type="text"
                placeholder={
                  showResult
                    ? "Conversation complete"
                    : "Type your reply..."
                }
                className="flex-1 bg-transparent outline-none px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:text-slate-400"
              />
              <LanguageSelect
                value={micSelection}
                onChange={handleLanguageChange}
                disabled={inputDisabled}
              />
              <MicButton
                disabled={inputDisabled}
                language={micSelection}
                onTranscript={handleTranscript}
                onStatusChange={(status, error) => {
                  setVoiceStatus(status);
                  setVoiceError(error);
                }}
              />
              <button
                type="submit"
                disabled={inputDisabled || !inputValue.trim()}
                aria-label="Send"
                className="shrink-0 h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 hover:bg-slate-700 disabled:hover:bg-gray-200 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M2 10a.75.75 0 01.75-.75h12.59l-3.9-3.9a.75.75 0 111.06-1.06l5.18 5.18a.75.75 0 010 1.06l-5.18 5.18a.75.75 0 11-1.06-1.06l3.9-3.9H2.75A.75.75 0 012 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            {(voiceStatus === "recording" ||
              voiceStatus === "transcribing" ||
              (voiceStatus === "error" && voiceError)) && (
              <p
                className={`max-w-2xl mx-auto mt-1.5 text-xs ${
                  voiceStatus === "error" ? "text-amber-600" : "text-slate-400"
                }`}
              >
                {voiceStatus === "recording" && "Listening… click the mic again to stop."}
                {voiceStatus === "transcribing" && "Transcribing…"}
                {voiceStatus === "error" && voiceError}
              </p>
            )}
          </form>
        </div>

        {/* Desktop progress panel */}
        <aside className="hidden md:flex md:flex-col w-80 shrink-0 border-l border-gray-200 px-6 py-6 overflow-y-auto">
          {permit ? (
            <ProgressPanel permit={permit} progress={progress} />
          ) : (
            <p className="text-sm text-slate-400">
              Figuring out which permit applies to you…
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
