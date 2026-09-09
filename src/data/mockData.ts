import type {
  ChatScriptStep,
  ExtractedFact,
  PermitDetails,
  SupportedServiceId,
} from "../types";

function values(facts: ExtractedFact[]) {
  return Object.fromEntries(facts.map((fact) => [fact.field, fact.value]));
}

function captured(facts: Record<string, unknown>, field: string) {
  return Object.hasOwn(facts, field) ? "met" as const : "pending" as const;
}

export function buildPermitDetails(
  serviceId: SupportedServiceId,
  extractedFacts: ExtractedFact[],
): PermitDetails {
  const facts = values(extractedFacts);
  if (serviceId === "temporary_event") {
    return {
      id: serviceId,
      name: "Temporary Event Permit",
      description: "Synthetic demo pre-check for a temporary event.",
      requirements: [
        { id: "req_1", label: "Event duration", status: captured(facts, "event_duration_days") },
        { id: "req_2", label: "Expected attendance", status: captured(facts, "expected_attendance") },
        { id: "req_3", label: "Venue permission", status: captured(facts, "venue_permission_status") },
        { id: "req_4", label: "Emergency plan", status: captured(facts, "emergency_plan_status") },
      ],
      documents: [
        { id: "venue-permission", name: "Venue permission", status: facts.venue_permission_status === "have" ? "have" : "missing" },
        { id: "emergency-plan", name: "Emergency plan", status: facts.emergency_plan_status === "have" ? "have" : "missing" },
      ],
    };
  }
  return {
    id: serviceId,
    name: "Temporary Food Stall Permit",
    description: "Synthetic demo pre-check for a temporary food stall.",
    requirements: [
      { id: "req_1", label: "Operating duration", status: captured(facts, "operating_days") },
      { id: "req_2", label: "Food-handler training", status: captured(facts, "food_handlers_trained") },
      { id: "req_3", label: "Handwashing facility", status: captured(facts, "handwashing_facility_available") },
    ],
    documents: [
      { id: "registration-proof", name: "Demo registration proof", status: facts.registration_proof_status === "have" ? "have" : "missing" },
    ],
  };
}

function displayFact(fact: ExtractedFact) {
  const labels: Record<string, string> = {
    event_duration_days: "Event duration",
    expected_attendance: "Attendance",
    venue_permission_status: "Venue permission",
    emergency_plan_status: "Emergency plan",
    uses_amplified_sound: "Amplified sound",
    serves_food: "Food service",
    operating_days: "Operating duration",
    food_handlers_trained: "Food handlers trained",
    handwashing_facility_available: "Handwashing facility",
    registration_proof_status: "Registration proof",
    uses_lpg: "LPG",
    uses_open_flame: "Open flame",
    serves_perishables: "Perishable food",
  };
  const label = labels[fact.field];
  if (!label) return null;
  let value = String(fact.value);
  if (fact.field === "event_duration_days" || fact.field === "operating_days") {
    value = `${fact.value} days`;
  } else if (fact.field === "expected_attendance") {
    value = String(fact.value);
  } else if (fact.value === true || fact.value === "have") {
    value = "Yes";
  } else if (fact.value === false || fact.value === "missing") {
    value = "No";
  }
  return `${label}: ${value}`;
}

export function buildChatScript(
  serviceId: SupportedServiceId,
  facts: ExtractedFact[],
): ChatScriptStep[] {
  const serviceName = serviceId === "temporary_event"
    ? "Temporary Event Permit"
    : "Temporary Food Stall Permit";
  const summary = facts.map(displayFact).filter(Boolean).join(" · ");
  return [
    {
      step: 1,
      aiMessage: `Bedrock identified: ${serviceName}.${summary ? ` AI extracted: ${summary}.` : ""}`,
      updatesRequirementId: null,
    },
    {
      step: 2,
      aiMessage: "I’ll keep the extracted facts above and ask only for anything still missing.",
      updatesRequirementId: "req_1",
    },
    {
      step: 3,
      aiMessage: "Thanks. The deterministic rule engine—not the AI—will decide the assessment.",
      updatesRequirementId: "req_2",
    },
    {
      step: 4,
      aiMessage: "I have enough information for this demo check.",
      updatesRequirementId: "req_3",
    },
  ];
}

export const eligibleNextSteps = [
  "Review the requirement-by-requirement assessment.",
  "Prepare any missing supporting documents.",
  "Confirm current requirements with the relevant authority.",
];

export const ineligibleReasons = [
  "One or more synthetic demo requirements were not met.",
];
