import type { DemoOutcome, PermitDetails } from "../types";
import { eligibleNextSteps, ineligibleReasons } from "../data/mockData";

interface ResultCardProps {
  outcome: DemoOutcome;
  permit: PermitDetails;
  onStartOver: () => void;
}

export function ResultCard({ outcome, permit, onStartOver }: ResultCardProps) {
  const isEligible = outcome === "eligible";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden max-w-xl w-full mx-auto">
      <div
        className={
          isEligible
            ? "bg-emerald-50 border-b border-emerald-100 px-6 py-5"
            : "bg-red-50 border-b border-red-100 px-6 py-5"
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={
              isEligible
                ? "h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0"
                : "h-10 w-10 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0"
            }
          >
            {isEligible ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <div>
            <h2
              className={
                isEligible
                  ? "text-lg font-semibold text-emerald-900"
                  : "text-lg font-semibold text-red-900"
              }
            >
              {isEligible ? "Eligible to Apply" : "Not Eligible"}
            </h2>
            <p
              className={
                isEligible
                  ? "text-sm text-emerald-700"
                  : "text-sm text-red-700"
              }
            >
              {permit.name}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        {isEligible ? (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                Requirements
              </p>
              <ul className="flex flex-col gap-1.5">
                {permit.requirements.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <span className="text-emerald-600">✓</span>
                    {req.label}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                Documents
              </p>
              <ul className="flex flex-col gap-1.5">
                {permit.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <span
                      className={
                        doc.status === "have"
                          ? "text-emerald-600"
                          : "text-amber-500"
                      }
                    >
                      {doc.status === "have" ? "✓" : "⚠"}
                    </span>
                    {doc.name}
                    {doc.status === "missing" && (
                      <span className="text-xs text-amber-600">(missing)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                Next Steps
              </p>
              <ol className="flex flex-col gap-1.5">
                {eligibleNextSteps.map((step, i) => (
                  <li
                    key={step}
                    className="flex gap-2 text-sm text-slate-700"
                  >
                    <span className="text-slate-400 shrink-0">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
              Failed Requirements
            </p>
            <ul className="flex flex-col gap-1.5">
              {ineligibleReasons.map((reason) => (
                <li
                  key={reason}
                  className="flex gap-2 text-sm text-slate-700"
                >
                  <span className="text-red-500 shrink-0">✕</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onStartOver}
          type="button"
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-gray-50 transition-colors"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
