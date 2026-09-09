import { useState } from "react";
import type { FormEvent } from "react";

interface LandingProps {
  onStart: (input: string) => void | Promise<void>;
  isLoading?: boolean;
  error?: string;
  nextQuestion?: string;
}

const EXAMPLES = [
  "I want to organise a 2 day event for 100 people in Bengaluru",
  "I want to run a temporary food stall in Bengaluru",
];

export function Landing({
  onStart,
  isLoading = false,
  error,
  nextQuestion,
}: LandingProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    void onStart(trimmed);
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
              MP
            </div>
            <span className="font-semibold text-slate-900">
              Municipal Permit Assistant
            </span>
          </div>
          <nav>
            <a
              href="#how-it-works"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              How it works
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center py-20">
          <h1 className="text-4xl sm:text-5xl font-semibold text-slate-900 tracking-tight text-balance">
            Know if you&apos;re eligible before you apply.
          </h1>
          <p className="mt-4 text-slate-500 text-lg">
            Describe what you&apos;re trying to do, and we&apos;ll walk you
            through eligibility, requirements, and documents.
          </p>

          <form onSubmit={handleSubmit} className="mt-10">
            <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 transition-shadow px-2 py-2">
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                type="text"
                placeholder="e.g., I want to organise a 2 day event for 100 people in Bengaluru..."
                className="flex-1 bg-transparent outline-none px-3 py-3 text-slate-900 placeholder:text-slate-400 text-base"
              />
              <button
                type="submit"
                disabled={!value.trim() || isLoading}
                aria-label="Start"
                className="shrink-0 h-11 w-11 rounded-lg bg-slate-900 text-white flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 hover:bg-slate-700 disabled:hover:bg-gray-200 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
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

          {isLoading && (
            <p className="mt-3 text-sm text-slate-500">Asking Bedrock to identify the permit…</p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {nextQuestion && (
            <p className="mt-3 text-sm text-amber-700">{nextQuestion}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setValue(ex)}
                type="button"
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </main>

      <section id="how-it-works" className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-xl font-semibold text-slate-900 text-center">
            How it works
          </h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                title: "Tell us your goal",
                desc: "Describe what you're trying to do in plain language.",
              },
              {
                title: "Answer a few questions",
                desc: "Our assistant identifies the right permit and asks what it needs to know.",
              },
              {
                title: "Get your result",
                desc: "See eligibility, required documents, and clear next steps.",
              },
            ].map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border border-gray-200 bg-white p-6"
              >
                <div className="h-8 w-8 rounded-full bg-slate-900 text-white text-sm flex items-center justify-center font-medium">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-medium text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
