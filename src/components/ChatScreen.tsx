import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  AssessmentStatus,
  ChatAssessResponse,
  ChatMessage,
  DemoOutcome,
  ExtractedFact,
  IntakeResponse,
  PermitDetails,
} from "../types";
import { buildChatScript, buildPermitDetails } from "../data/mockData";
import { ProgressPanel } from "./ProgressPanel";
import { ResultCard } from "./ResultCard";
import { TypingIndicator } from "./TypingIndicator";

interface ChatScreenProps {
  initialInput: string;
  intake: IntakeResponse;
  demoOutcome: DemoOutcome;
  onAssessmentStatusChange: (status: AssessmentStatus) => void;
  onStartOver: () => void;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

function clonePermit(permitDetails: PermitDetails): PermitDetails {
  return {
    ...permitDetails,
    requirements: permitDetails.requirements.map((r) => ({ ...r })),
    documents: permitDetails.documents.map((d) => ({ ...d })),
  };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg_${idCounter}`;
}

export function ChatScreen({
  initialInput,
  intake,
  demoOutcome,
  onAssessmentStatusChange,
  onStartOver,
}: ChatScreenProps) {
  const permitDetails = buildPermitDetails(intake.service_id!, intake.facts);
  const [permit, setPermit] = useState<PermitDetails>(() =>
    clonePermit(permitDetails),
  );
  const [facts, setFacts] = useState<ExtractedFact[]>(intake.facts);
  const [contradictions, setContradictions] = useState<string[]>(
    intake.contradictions,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId(), sender: "user", text: initialInput },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [progressOpen, setProgressOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Kick off the conversation with the first script step.
  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => {
      const firstMessage = buildChatScript(
        intake.service_id!,
        intake.facts,
      )[0].aiMessage;
      setMessages((prev) => [
        ...prev,
        { id: nextId(), sender: "ai", text: firstMessage },
      ]);
      setIsTyping(false);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping, showResult]);

  const inputDisabled = isTyping || showResult;

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || inputDisabled) return;

    setMessages((prev) => [
      ...prev,
      { id: nextId(), sender: "user", text: trimmed },
    ]);
    setInputValue("");
    setIsTyping(true);

    try {
      const existingFacts = Object.fromEntries(
        [...intake.facts, ...facts].map((fact) => [fact.field, fact.value]),
      );
      const response = await fetch(`${API_BASE_URL}/api/chat-assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          service_id: intake.service_id,
          existing_facts: existingFacts,
          existing_contradictions: contradictions,
        }),
      });
      if (!response.ok) throw new Error("Follow-up assessment failed");
      const result = (await response.json()) as ChatAssessResponse;
      const serviceId = result.extracted_facts.service_id ?? intake.service_id!;
      const accumulatedFacts: ExtractedFact[] = Object.entries(
        result.extracted_facts,
      )
        .filter(([field, value]) => field !== "service_id" && value !== null)
        .map(([field, value]) => ({
          field,
          value,
          evidence: "Accumulated and validated by the backend",
        }));
      setFacts(accumulatedFacts);
      setContradictions(result.contradictions);
      setPermit(clonePermit(buildPermitDetails(serviceId, accumulatedFacts)));

      const status = result.assessment.overall_status;
      onAssessmentStatusChange(status);
      const labels: Partial<Record<AssessmentStatus, string>> = {
        MORE_INFORMATION_NEEDED: "More information needed",
        UNSUPPORTED: "Unsupported",
        NEEDS_VERIFICATION: "Needs verification",
      };
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          sender: "ai",
          text: `${labels[status] ? `${labels[status]}: ` : ""}${result.explanation}`,
        },
      ]);
      if (
        status === "MEETS_ASSESSED_REQUIREMENTS" ||
        status === "REQUIREMENTS_NOT_MET"
      ) {
        setShowResult(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          sender: "ai",
          text: "I could not process that follow-up. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  const resolvedCount = permit.requirements.filter(
    (r) => r.status !== "pending",
  ).length;
  const progress = showResult
    ? 100
    : Math.round((resolvedCount / permit.requirements.length) * 100);

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
              <ProgressPanel permit={permit} progress={progress} />
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
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 text-white px-4 py-2.5 text-sm"
                        : "max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 text-slate-800 px-4 py-2.5 text-sm"
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <TypingIndicator />
                </div>
              )}
              {showResult && (
                <div className="pt-2">
                  <ResultCard
                    outcome={demoOutcome}
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
          </form>
        </div>

        {/* Desktop progress panel */}
        <aside className="hidden md:flex md:flex-col w-80 shrink-0 border-l border-gray-200 px-6 py-6 overflow-y-auto">
          <ProgressPanel permit={permit} progress={progress} />
        </aside>
      </div>
    </div>
  );
}
