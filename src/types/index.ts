import type { VoiceLanguage } from "../api/deepgram";

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
  /** Language this AI message was authored/spoken in (used to pick the TTS voice). */
  language?: VoiceLanguage;
}

export type DemoOutcome = "eligible" | "ineligible";

export type AppScreen = "landing" | "chat";
