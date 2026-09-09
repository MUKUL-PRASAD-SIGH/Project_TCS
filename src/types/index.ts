export type RequirementStatus = "pending" | "met" | "failed";
export type DocumentStatus = "have" | "missing";

export interface Requirement {
  id: string;
  label: string;
  status: RequirementStatus;
}

export interface PermitDocument {
  id: string;
  name: string;
  status: DocumentStatus;
}

export interface PermitDetails {
  id: string;
  name: string;
  description: string;
  requirements: Requirement[];
  documents: PermitDocument[];
}

export interface ChatScriptStep {
  step: number;
  aiMessage: string;
  updatesRequirementId: string | null;
}

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
}

export type DemoOutcome = "eligible" | "ineligible";

export type AppScreen = "landing" | "chat";

export type SupportedServiceId = "temporary_event" | "temporary_food_stall";

export interface ExtractedFact {
  field: string;
  value: string | number | boolean | null;
  evidence: string;
}

export interface IntakeResponse {
  service_id: SupportedServiceId | null;
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

export interface ChatAssessResponse {
  provider: "bedrock_glm5" | "structured_fallback";
  extracted_facts: Record<string, string | number | boolean | null> & {
    service_id: SupportedServiceId | null;
  };
  contradictions: string[];
  assessment: {
    overall_status: AssessmentStatus;
    passed: Array<{ rule_id: string; description: string }>;
    failed: Array<{ rule_id: string; description: string }>;
    unknown: Array<{ rule_id: string; description: string }>;
    not_applicable: Array<{ rule_id: string; description: string }>;
    missing_fields?: string[];
    rule_version: string | null;
  };
  explanation: string;
  disclaimer: string;
}
