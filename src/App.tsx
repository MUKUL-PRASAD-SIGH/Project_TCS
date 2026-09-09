import { useState } from "react";
import { Landing } from "./components/Landing";
import { ChatScreen } from "./components/ChatScreen";
import type { AppScreen, DemoOutcome } from "./types";

function App() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [initialInput, setInitialInput] = useState("");
  const [demoOutcome, setDemoOutcome] = useState<DemoOutcome>("eligible");

  function handleStart(input: string) {
    setInitialInput(input);
    setScreen("chat");
  }

  function handleStartOver() {
    setScreen("landing");
    setInitialInput("");
  }

  return (
    <>
      {screen === "landing" ? (
        <Landing onStart={handleStart} />
      ) : (
        <ChatScreen
          key={initialInput}
          initialInput={initialInput}
          demoOutcome={demoOutcome}
          onStartOver={handleStartOver}
        />
      )}

      {/* Demo-only control: not part of the product UI. */}
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
    </>
  );
}

export default App;
