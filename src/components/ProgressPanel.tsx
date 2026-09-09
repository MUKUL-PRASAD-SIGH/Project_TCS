import type { ChatAssessment, ExtractedFact } from "../types";
import {
  displayFactValue,
  displayFieldName,
  displayServiceName,
} from "../data/mockData";
import { RuleResults } from "./RuleResults";

interface ProgressPanelProps {
  serviceId: string;
  facts: ExtractedFact[];
  assessment: ChatAssessment | null;
  explanation: string;
}

const STATUS_LABELS: Record<ChatAssessment["overall_status"], string> = {
  MEETS_ASSESSED_REQUIREMENTS: "Meets assessed requirements",
  REQUIREMENTS_NOT_MET: "Requirements not met",
  MORE_INFORMATION_NEEDED: "More information needed",
  NEEDS_VERIFICATION: "Needs verification",
  UNSUPPORTED: "Unsupported",
};

export function ProgressPanel({
  serviceId,
  facts,
  assessment,
  explanation,
}: ProgressPanelProps) {
  const counts = assessment?.counts;
  const total = counts
    ? counts.passed + counts.failed + counts.unknown + counts.not_applicable
    : 0;
  const resolved = counts
    ? counts.passed + counts.failed + counts.not_applicable
    : 0;
  const progress = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Identified Permit
        </p>
        <p className="mt-1 font-medium text-slate-900">
          {displayServiceName(serviceId)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Demonstration using synthetic rules. Not official permit advice.
        </p>
      </div>

      {facts.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
            AI Extracted
          </p>
          <dl className="flex flex-col gap-2">
            {facts.map((fact) => (
              <div key={fact.field} className="text-sm">
                <dt className="inline text-slate-500">
                  {displayFieldName(fact.field)}:{" "}
                </dt>
                <dd className="inline font-medium text-slate-800">
                  {displayFactValue(fact.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {assessment && assessment.rule_results.length > 0 && (
        <>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Deterministic Checks
              </p>
              <span className="text-xs font-medium text-slate-600">
                {progress}% resolved
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {counts?.passed ?? 0} passed · {counts?.failed ?? 0} failed ·{" "}
              {counts?.unknown ?? 0} unknown · {counts?.not_applicable ?? 0} N/A
            </p>
          </div>
          <RuleResults results={assessment.rule_results} />
        </>
      )}

      {assessment && assessment.rule_results.length === 0 && (
        <div>
          <p className="text-sm font-medium text-slate-800">
            {STATUS_LABELS[assessment.overall_status]}
          </p>
          <p className="mt-1 text-xs text-slate-500">{explanation}</p>
          {assessment.missing_fields.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
                Missing Information
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                {assessment.missing_fields.map((field) => (
                  <li key={field}>? {displayFieldName(field)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
