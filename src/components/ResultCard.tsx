import type { ChatAssessment } from "../types";
import { displayServiceName } from "../data/mockData";
import { RuleResults } from "./RuleResults";

interface ResultCardProps {
  assessment: ChatAssessment;
  explanation: string;
  serviceId: string;
  onStartOver: () => void;
}

const FINAL_STATUS_LABELS = {
  MEETS_ASSESSED_REQUIREMENTS: "Meets Assessed Requirements",
  REQUIREMENTS_NOT_MET: "Requirements Not Met",
} as const;

export function ResultCard({
  assessment,
  explanation,
  serviceId,
  onStartOver,
}: ResultCardProps) {
  const meetsRequirements =
    assessment.overall_status === "MEETS_ASSESSED_REQUIREMENTS";
  const statusLabel =
    assessment.overall_status === "REQUIREMENTS_NOT_MET"
      ? FINAL_STATUS_LABELS.REQUIREMENTS_NOT_MET
      : FINAL_STATUS_LABELS.MEETS_ASSESSED_REQUIREMENTS;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden max-w-xl w-full mx-auto">
      <div
        className={
          meetsRequirements
            ? "bg-emerald-50 border-b border-emerald-100 px-6 py-5"
            : "bg-red-50 border-b border-red-100 px-6 py-5"
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={
              meetsRequirements
                ? "h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0"
                : "h-10 w-10 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0"
            }
          >
            {meetsRequirements ? "✓" : "✕"}
          </div>
          <div>
            <h2
              className={
                meetsRequirements
                  ? "text-lg font-semibold text-emerald-900"
                  : "text-lg font-semibold text-red-900"
              }
            >
              {statusLabel}
            </h2>
            <p
              className={
                meetsRequirements
                  ? "text-sm text-emerald-700"
                  : "text-sm text-red-700"
              }
            >
              {displayServiceName(serviceId)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        <p className="text-sm text-slate-700">{explanation}</p>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
            Deterministic Checks
          </p>
          <RuleResults results={assessment.rule_results} showMessages />
        </div>

        <p className="text-xs text-slate-500">
          {assessment.counts.passed} passed · {assessment.counts.failed} failed ·{" "}
          {assessment.counts.unknown} unknown ·{" "}
          {assessment.counts.not_applicable} N/A
          {assessment.rule_version
            ? ` · Rule version ${assessment.rule_version}`
            : ""}
        </p>

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
