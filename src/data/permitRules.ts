// Local copy of the project's Licence_Permits.json (kept in sync manually —
// see README) so it resolves cleanly as a TS module inside src/.
import rawPermits from "./permitRules.json";

export interface RawPermit {
  permit_id: string;
  permit_name: string;
  min_age: number;
  citizenship: string[];
  allowed_business_types: string[];
  allowed_zones: string[];
  max_annual_turnover: number | null;
  required_documents: string[];
  license_fee_inr: number;
  processing_time_days: number;
}

export const permitRules: RawPermit[] = rawPermits as RawPermit[];

export function getPermitById(id: string): RawPermit | undefined {
  return permitRules.find((p) => p.permit_id === id);
}

export interface DerivedRequirement {
  id: string;
  label: string;
}

export interface DerivedDocument {
  id: string;
  name: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Deterministic, stable IDs for a permit's non-document eligibility
 * criteria — Gemini is told these exact IDs in the system prompt and
 * references them back in `newly_satisfied_requirements` once the user's
 * answers confirm each one. Keeping ID generation on our side (rather than
 * letting the model invent them) avoids ID drift across turns.
 */
export function deriveRequirements(permit: RawPermit): DerivedRequirement[] {
  const requirements: DerivedRequirement[] = [
    { id: "min_age", label: `Minimum age: ${permit.min_age}+` },
    { id: "citizenship", label: `Citizenship: ${permit.citizenship.join(" or ")}` },
    {
      id: "allowed_business_types",
      label: `Business type: ${permit.allowed_business_types.join(", ")}`,
    },
    {
      id: "allowed_zones",
      label: `Property zone: ${permit.allowed_zones.join(", ")}`,
    },
  ];
  if (permit.max_annual_turnover != null) {
    requirements.push({
      id: "max_annual_turnover",
      label: `Annual turnover under ₹${permit.max_annual_turnover.toLocaleString("en-IN")}`,
    });
  }
  return requirements;
}

/** Same idea as deriveRequirements, but for the permit's required documents. */
export function deriveDocuments(permit: RawPermit): DerivedDocument[] {
  return permit.required_documents.map((name) => ({
    id: `doc_${slugify(name)}`,
    name: name.replace(/_/g, " "),
  }));
}

export function describePermit(permit: RawPermit): string {
  return `Estimated fee: ₹${permit.license_fee_inr.toLocaleString("en-IN")} · Processing time: ~${permit.processing_time_days} day${permit.processing_time_days === 1 ? "" : "s"}`;
}
