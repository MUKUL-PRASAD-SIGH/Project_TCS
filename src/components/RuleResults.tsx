import type { RuleResult, RuleResultStatus } from "../types";

const STATUS_PRESENTATION: Record<
  RuleResultStatus,
  { icon: string; iconClass: string; textClass: string; label: string }
> = {
  PASS: {
    icon: "✓",
    iconClass: "text-emerald-600",
    textClass: "text-slate-700",
    label: "Pass",
  },
  FAIL: {
    icon: "✕",
    iconClass: "text-red-500",
    textClass: "text-slate-700",
    label: "Fail",
  },
  UNKNOWN: {
    icon: "?",
    iconClass: "text-amber-600",
    textClass: "text-slate-700",
    label: "Unknown",
  },
  NOT_APPLICABLE: {
    icon: "N/A",
    iconClass: "text-slate-400",
    textClass: "text-slate-400",
    label: "Not applicable",
  },
};

interface RuleResultsProps {
  results: RuleResult[];
  showMessages?: boolean;
}

export function RuleResults({
  results,
  showMessages = false,
}: RuleResultsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {results.map((result) => {
        const presentation = STATUS_PRESENTATION[result.status];
        return (
          <li key={result.rule_id} className="flex items-start gap-2 text-sm">
            <span
              className={`w-5 shrink-0 font-semibold ${presentation.iconClass}`}
              aria-label={presentation.label}
              title={presentation.label}
            >
              {presentation.icon}
            </span>
            <span className={presentation.textClass}>
              {result.label || result.description || result.rule_id}
              {showMessages && result.message && (
                <span className="block mt-0.5 text-xs text-slate-500">
                  {result.message}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
