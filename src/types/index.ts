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

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  /** Language this AI message was authored/spoken in (used to pick the TTS voice). */
  language?: VoiceLanguage;
  /** Set when this message represents one or more mock-uploaded files rather than typed/spoken text. */
  fileNames?: string[];
  /** Whether TTS should start automatically as soon as this (AI) message appears. */
  autoPlay?: boolean;
}

export type AppScreen = "landing" | "chat";
