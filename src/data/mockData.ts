import type { ChatScriptStep, ExtractedFact } from "../types";

const SERVICE_NAMES: Record<string, string> = {
  temporary_event: "Temporary Event Permit",
  temporary_food_stall: "Temporary Food Stall Permit",
};

const ACRONYMS = new Set(["lpg", "id"]);

export function displayServiceName(serviceId: string) {
  return (
    SERVICE_NAMES[serviceId] ??
    serviceId
      .split("_")
      .map((part) =>
        ACRONYMS.has(part)
          ? part.toUpperCase()
          : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
      )
      .join(" ")
  );
}

export function displayFieldName(field: string) {
  return field
    .replace(/_status$/, "")
    .split("_")
    .map((part) =>
      ACRONYMS.has(part)
        ? part.toUpperCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(" ");
}

export function displayFactValue(value: ExtractedFact["value"]) {
  if (value === true || value === "have") return "Yes";
  if (value === false || value === "missing") return "No";
  return String(value);
}

export function buildChatScript(
  serviceId: string,
  facts: ExtractedFact[],
): ChatScriptStep[] {
  const summary = facts
    .filter((fact) => fact.value !== null)
    .map(
      (fact) =>
        `${displayFieldName(fact.field)}: ${displayFactValue(fact.value)}`,
    )
    .join(" · ");
  return [
    {
      step: 1,
      aiMessage: `Bedrock identified: ${displayServiceName(serviceId)}.${summary ? ` AI extracted: ${summary}.` : ""}`,
    },
  ];
}
