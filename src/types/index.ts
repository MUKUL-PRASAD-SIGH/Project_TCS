export interface ChatScriptStep {
  step: number;
  aiMessage: string;
}

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
}

export type AppScreen = "landing" | "chat";

export interface ExtractedFact {
  field: string;
  value: string | number | boolean | null;
  evidence: string;
}

export interface IntakeResponse {
  service_id: string | null;
  facts: ExtractedFact[];
  contradictions: string[];
  provider: "bedrock" | "structured_fallback";
  provider_available: boolean;
  label: string;
  status: "SUPPORTED" | "MORE_INFORMATION_NEEDED" | "UNSUPPORTED";
  message: string | null;
  next_question: string | null;
}

export type AssessmentStatus =
  | "MEETS_ASSESSED_REQUIREMENTS"
  | "REQUIREMENTS_NOT_MET"
  | "MORE_INFORMATION_NEEDED"
  | "NEEDS_VERIFICATION"
  | "UNSUPPORTED";

export type RuleResultStatus =
  | "PASS"
  | "FAIL"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export interface RuleResult {
  rule_id: string;
  status: RuleResultStatus;
  label: string;
  description?: string;
  message?: string;
  actual_value?: unknown;
  expected?: Record<string, unknown> | null;
  rule_version?: string;
}

export interface AssessmentCounts {
  passed: number;
  failed: number;
  unknown: number;
  not_applicable: number;
}

export interface ChatAssessment {
  overall_status: AssessmentStatus;
  rule_results: RuleResult[];
  counts: AssessmentCounts;
  missing_fields: string[];
  rule_version: string | null;
}

export interface NextQuestion {
  field: string;
  label: string;
  question: string;
  input_type: "choice" | "number" | "date" | "text";
  options: string[];
}

export interface ChatAssessResponse {
  provider: "bedrock_glm5" | "structured_fallback";
  extracted_facts: Record<string, string | number | boolean | null> & {
    service_id: string | null;
  };
  accumulated_facts: Record<string, string | number | boolean | null>;
  contradictions: string[];
  assessment: ChatAssessment;
  next_question: NextQuestion | null;
  explanation: string;
  disclaimer: string;
}
