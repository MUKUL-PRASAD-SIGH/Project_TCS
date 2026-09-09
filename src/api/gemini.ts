import type { RawPermit } from "../data/permitRules";
import {
  deriveDocuments,
  deriveRequirements,
  permitRules,
} from "../data/permitRules";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
// gemini-2.5-flash was retired by Google (the API now 404s with a redirect
// notice); gemini-3.6-flash is its replacement and uses the identical
// request/response shape, verified against the live API.
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export class GeminiConfigError extends Error {}
export class GeminiRequestError extends Error {}

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

export interface GeminiEvaluation {
  reply_message: string;
  newly_satisfied_requirements: string[];
  is_evaluation_complete: boolean;
  final_eligibility: boolean | null;
  matched_permit_id: string | null;
}

export type DemoOverride = "eligible" | "ineligible" | null;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply_message: { type: "string" },
    newly_satisfied_requirements: {
      type: "array",
      items: { type: "string" },
    },
    is_evaluation_complete: { type: "boolean" },
    final_eligibility: { type: "boolean", nullable: true },
    matched_permit_id: { type: "string", nullable: true },
  },
  required: [
    "reply_message",
    "newly_satisfied_requirements",
    "is_evaluation_complete",
    "final_eligibility",
    "matched_permit_id",
  ],
};

function requireApiKey(): string {
  if (!API_KEY) {
    throw new GeminiConfigError(
      "The assistant is unavailable: VITE_GEMINI_API_KEY is not set.",
    );
  }
  return API_KEY;
}

function buildPermitCatalogBlock(): string {
  const catalog = permitRules.map((p) => ({
    permit_id: p.permit_id,
    permit_name: p.permit_name,
    min_age: p.min_age,
    citizenship: p.citizenship,
    allowed_business_types: p.allowed_business_types,
    allowed_zones: p.allowed_zones,
    max_annual_turnover: p.max_annual_turnover,
    required_documents: p.required_documents,
  }));
  return `PERMIT CATALOG (choose the single best match for matched_permit_id):\n${JSON.stringify(catalog)}`;
}

function buildMatchedPermitBlock(
  permit: RawPermit,
  confirmedIds: string[],
): string {
  const requirements = deriveRequirements(permit);
  const documents = deriveDocuments(permit);
  const confirmed = new Set(confirmedIds);

  const reqLines = requirements
    .map((r) => `- ${r.id}: ${r.label}${confirmed.has(r.id) ? " (already confirmed)" : ""}`)
    .join("\n");
  const docLines = documents
    .map((d) => `- ${d.id}: ${d.name}${confirmed.has(d.id) ? " (already provided)" : ""}`)
    .join("\n");

  return [
    `CURRENT PERMIT: ${permit.permit_name} (permit_id: ${permit.permit_id})`,
    `matched_permit_id MUST be "${permit.permit_id}" for the rest of this conversation.`,
    "",
    "REQUIREMENTS TO VERIFY — reference these exact IDs in newly_satisfied_requirements once the user's answer confirms them:",
    reqLines,
    "",
    "DOCUMENTS REQUIRED — reference these exact IDs once the user confirms/uploads them:",
    docLines,
    "",
    "Do not ask again about items already marked (already confirmed) / (already provided) above.",
  ].join("\n");
}

function buildSystemInstruction(params: {
  sessionLanguage: string;
  matchedPermit: RawPermit | null;
  confirmedIds: string[];
  demoOverride: DemoOverride;
}): string {
  const { sessionLanguage, matchedPermit, confirmedIds, demoOverride } = params;

  const parts = [
    "You are a helpful Municipal Permit Assistant. Use the provided permit rules to evaluate the user. Ask one question at a time to gather missing information. Do not overwhelm the user.",
    "",
    `You MUST respond entirely in the language corresponding to this code: ${sessionLanguage}.`,
    "",
    "You MUST always reply with a single raw JSON object (no markdown fences, no extra commentary) matching exactly this shape:",
    '{ "reply_message": string, "newly_satisfied_requirements": string[], "is_evaluation_complete": boolean, "final_eligibility": boolean | null, "matched_permit_id": string | null }',
    "- reply_message: what to say to the user next — a clarifying question, an acknowledgment, or the final verdict explanation. Always written in the language above.",
    "- newly_satisfied_requirements: any requirement/document IDs (see below) that THIS user message newly confirms. Only ids that weren't already confirmed. Empty array if none.",
    "- is_evaluation_complete: true only once you have enough information across the whole conversation to give a final verdict.",
    "- final_eligibility: true or false once is_evaluation_complete is true; otherwise null.",
    "- matched_permit_id: the permit_id you've determined applies, or null if not yet determined.",
    "",
    matchedPermit
      ? buildMatchedPermitBlock(matchedPermit, confirmedIds)
      : buildPermitCatalogBlock(),
  ];

  if (demoOverride) {
    parts.push(
      "",
      `DEMO OVERRIDE: This is a live demo. Once you set is_evaluation_complete to true, you MUST set final_eligibility to ${demoOverride === "eligible" ? "true" : "false"}, regardless of the user's actual answers. Still reason and ask questions naturally — only the final verdict is overridden.`,
    );
  }

  return parts.join("\n");
}

function extractJsonText(raw: string): string {
  // Defensive: strip ```json fences if the model adds them despite instructions.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/**
 * Sends the full conversation to Gemini and returns its structured
 * evaluation. `matchedPermit` should be null until a previous call has
 * returned a `matched_permit_id` — pass the resolved RawPermit from then on
 * so the system prompt stays small and the ID list stays stable.
 */
export async function askGemini(params: {
  history: GeminiTurn[];
  newUserText: string;
  sessionLanguage: string;
  matchedPermit: RawPermit | null;
  confirmedIds: string[];
  demoOverride: DemoOverride;
}): Promise<GeminiEvaluation> {
  const key = requireApiKey();

  const systemInstruction = buildSystemInstruction({
    sessionLanguage: params.sessionLanguage,
    matchedPermit: params.matchedPermit,
    confirmedIds: params.confirmedIds,
    demoOverride: params.demoOverride,
  });

  const contents = [
    ...params.history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: params.newUserText }] },
  ];

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    throw new GeminiRequestError(
      `The assistant failed to respond (${res.status}). Please try again.`,
    );
  }

  const data = await res.json();
  const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    throw new GeminiRequestError("The assistant returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch {
    throw new GeminiRequestError("The assistant returned an invalid response.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as GeminiEvaluation).reply_message !== "string" ||
    !Array.isArray((parsed as GeminiEvaluation).newly_satisfied_requirements)
  ) {
    throw new GeminiRequestError("The assistant returned an unexpected response shape.");
  }

  return parsed as GeminiEvaluation;
}
