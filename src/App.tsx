import { useState } from "react";
import { Landing } from "./components/Landing";
import { ChatScreen } from "./components/ChatScreen";
import type { AppScreen } from "./types";
import type { VoiceLanguage } from "./api/deepgram";
import type { DemoOverride } from "./api/gemini";

type DemoOverrideChoice = "auto" | "eligible" | "ineligible";

function App() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [initialInput, setInitialInput] = useState("");
  const [initialLanguage, setInitialLanguage] = useState<VoiceLanguage | null>(
    null,
  );
  const [demoOverrideChoice, setDemoOverrideChoice] =
    useState<DemoOverrideChoice>("auto");
  const demoOverride: DemoOverride =
    demoOverrideChoice === "auto" ? null : demoOverrideChoice;

  function handleStart(input: string, language: VoiceLanguage | null) {
    setInitialInput(input);
    setInitialLanguage(language);
    setScreen("chat");
  }

  function handleStartOver() {
    setScreen("landing");
    setInitialInput("");
    setInitialLanguage(null);
  }

  return (
    <>
      {screen === "landing" ? (
        <Landing onStart={handleStart} />
      ) : (
        <ChatScreen
          key={initialInput}
          initialInput={initialInput}
          initialLanguage={initialLanguage}
          demoOverride={demoOverride}
          onStartOver={handleStartOver}
        />
      )}

      {/* Demo-only control: not part of the product UI. */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white shadow-md p-1 text-xs">
          <button
            type="button"
            onClick={() => setDemoOverrideChoice("auto")}
            title="Let Gemini decide eligibility for real, based on the conversation"
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              demoOverrideChoice === "auto"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => setDemoOverrideChoice("eligible")}
            title="Force the final verdict to Eligible, for demo purposes"
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              demoOverrideChoice === "eligible"
                ? "bg-emerald-600 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Force Eligible
          </button>
          <button
            type="button"
            onClick={() => setDemoOverrideChoice("ineligible")}
            title="Force the final verdict to Not Eligible, for demo purposes"
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              demoOverrideChoice === "ineligible"
                ? "bg-red-500 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Force Ineligible
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
