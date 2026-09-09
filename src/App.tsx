import { useState } from "react";
import { Landing } from "./components/Landing";
import { ChatScreen } from "./components/ChatScreen";
import type { AppScreen, IntakeResponse } from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

function App() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [initialInput, setInitialInput] = useState("");
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextQuestion, setNextQuestion] = useState("");

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
          onStartOver={handleStartOver}
        />
      )}
    </>
  );
}

export default App;
