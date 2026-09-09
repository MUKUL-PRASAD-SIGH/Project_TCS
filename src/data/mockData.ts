import type { ChatScriptStep, PermitDetails } from "../types";

export const permitDetails: PermitDetails = {
  id: "restaurant_permit_01",
  name: "Restaurant / Food Business Permit",
  description: "Required for opening and operating a food service establishment.",
  requirements: [
    { id: "req_1", label: "Business Type", status: "pending" },
    { id: "req_2", label: "Property Size (Min 500 sq ft)", status: "pending" },
    { id: "req_3", label: "Ownership/Lease Status", status: "pending" },
  ],
  documents: [
    { id: "doc_1", name: "Identity Proof", status: "have" },
    { id: "doc_2", name: "Property / Lease Agreement", status: "have" },
    { id: "doc_3", name: "Fire Safety Certificate", status: "missing" },
    { id: "doc_4", name: "Food Safety Certificate", status: "missing" },
  ],
};

export const chatScript: ChatScriptStep[] = [
  {
    step: 1,
    aiMessage:
      "It looks like you are trying to open a food business. I can help you check your eligibility for a Restaurant Permit. First, what type of food business are you planning to open?",
    updatesRequirementId: null,
  },
  {
    step: 2,
    aiMessage:
      "Sounds great! What is the approximate floor area of the property in square feet?",
    updatesRequirementId: "req_1",
  },
  {
    step: 3,
    aiMessage:
      "Got it. Finally, do you own this property, or are you currently leasing it?",
    updatesRequirementId: "req_2",
  },
  {
    step: 4,
    aiMessage:
      "Thank you! I have enough information to evaluate your eligibility. Give me just a moment.",
    updatesRequirementId: "req_3",
  },
];

export const eligibleNextSteps = [
  "Obtain the required Fire Safety and Food Safety certificates.",
  "Complete the online application form with the details you provided.",
  "Submit your application along with all supporting documents.",
  "Await inspection scheduling from the municipal office.",
];

export const ineligibleReasons = [
  "Floor area must be at least 500 sq ft. Your property does not meet this requirement.",
];
