import { useState } from "react";
import { Landing } from "./components/Landing";
import { ChatScreen } from "./components/ChatScreen";
import type {
  AppScreen,
  AssessmentStatus,
  DemoOutcome,
  IntakeResponse,
} from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

function App() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [initialInput, setInitialInput] = useState("");
  const [demoOutcome, setDemoOutcome] = useState<DemoOutcome>("eligible");
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextQuestion, setNextQuestion] = useState("");
  const [assessmentStatus, setAssessmentStatus] =
    useState<AssessmentStatus | null>(null);

  async function handleStart(input: string) {
    setIsLoading(true);
    setError("");
    setNextQuestion("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      if (!response.ok) {
        throw new Error("The permit service could not classify this request.");
      }
      const result = (await response.json()) as IntakeResponse;
      if (result.status === "UNSUPPORTED") {
        setNextQuestion(
          result.message ??
            "This permit type or jurisdiction is not currently supported.",
        );
        return;
      }
      if (!result.service_id) {
        setNextQuestion(
          result.next_question ?? "Please clarify which permit service you need.",
        );
        return;
      }
      setIntake(result);
      setInitialInput(input);
      setScreen("chat");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The permit service is unavailable.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleStartOver() {
    setScreen("landing");
    setInitialInput("");
    setIntake(null);
    setError("");
    setNextQuestion("");
    setAssessmentStatus(null);
  }

  function handleAssessmentStatus(status: AssessmentStatus) {
    setAssessmentStatus(status);
    if (status === "MEETS_ASSESSED_REQUIREMENTS") {
      setDemoOutcome("eligible");
    } else if (status === "REQUIREMENTS_NOT_MET") {
      setDemoOutcome("ineligible");
    }
  }

  return (
    <>
      {screen === "landing" || !intake ? (
        <Landing
          onStart={handleStart}
          isLoading={isLoading}
          error={error}
          nextQuestion={nextQuestion}
        />
      ) : (
        <ChatScreen
          key={initialInput}
          initialInput={initialInput}
          intake={intake}
          demoOutcome={demoOutcome}
          onAssessmentStatusChange={handleAssessmentStatus}
          onStartOver={handleStartOver}
        />
      )}

      {(assessmentStatus === "MEETS_ASSESSED_REQUIREMENTS" ||
        assessmentStatus === "REQUIREMENTS_NOT_MET") && (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white shadow-md p-1 text-xs">
          <button
            type="button"
            onClick={() => setDemoOutcome("eligible")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              demoOutcome === "eligible"
                ? "bg-emerald-600 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Eligible
          </button>
          <button
            type="button"
            onClick={() => setDemoOutcome("ineligible")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              demoOutcome === "ineligible"
                ? "bg-red-500 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Ineligible
          </button>
        </div>
      </div>
      )}
    </>
  );
}

export default App;
