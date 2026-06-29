export type WorkflowStatus =
  | "submitted"
  | "under_review"
  | "needs_more_information"
  | "approved"
  | "active"
  | "rejected"
  | "expired";

export const accessAccountWorkflow = [
  {
    key: "submitted",
    label: "Application Submitted",
    description: "User completed the access account application and uploaded required documents.",
  },
  {
    key: "under_review",
    label: "Admin Review",
    description: "Administrator verifies identity document, contact information, and duplicate account risk.",
  },
  {
    key: "needs_more_information",
    label: "Needs More Information",
    description: "Optional step used when the applicant must correct information or upload another document.",
  },
  {
    key: "approved",
    label: "Approved",
    description: "Application is approved and an Access ID is generated.",
  },
  {
    key: "active",
    label: "Account Active",
    description: "Welcome SMS/email is sent and the user may request daily access.",
  },
];

export const dailyAccessWorkflow = [
  {
    key: "submitted",
    label: "Request Submitted",
    description: "User submits quick request, favorite, or full request wizard.",
  },
  {
    key: "account_validation",
    label: "Account Validation",
    description: "System confirms active Access ID, account status, and expiration date.",
  },
  {
    key: "rules_validation",
    label: "Business Rule Validation",
    description: "System evaluates gate, purpose, party size, summit permit, organization, and special restrictions.",
  },
  {
    key: "gate_lookup",
    label: "Gate Combination Lookup",
    description: "System locates the active combination for the requested gate and date.",
  },
  {
    key: "approved_sms",
    label: "Approved + SMS Sent",
    description: "Approval is recorded, SMS is sent, and the trip appears in history.",
  },
];

export const defaultBusinessRules = [
  {
    name: "Access account validity period",
    category: "Accounts",
    currentValue: "24 months",
    effect: "Approved accounts expire two years after issuance unless renewed.",
  },
  {
    name: "Public gates",
    category: "Gates",
    currentValue: "Wood Valley, Honanui, ʻĀinapō",
    effect: "Only active public gates can be selected in the request wizard.",
  },
  {
    name: "Overnight / summit permit",
    category: "Permits",
    currentValue: "Required when overnight access is selected",
    effect: "Wizard displays State and/or NPS summit permit field only when required.",
  },
  {
    name: "Emergency contact override",
    category: "Safety",
    currentValue: "Optional",
    effect: "User can use default emergency contact or provide a different number for the trip.",
  },
  {
    name: "Maximum party size",
    category: "Requests",
    currentValue: "10 unless admin approved",
    effect: "Large parties route to review instead of automatic approval.",
  },
  {
    name: "Gate combination disclosure",
    category: "Security",
    currentValue: "SMS only after approval",
    effect: "Gate codes are never displayed to unauthorized users or exposed in frontend code.",
  },
];

export const communicationTemplates = [
  {
    name: "Daily Access Approved",
    channel: "SMS",
    trigger: "Daily request approved",
    body: "Kapāpala Access approved. Date: {{date}}. Gate: {{gate}}. Combination: {{combo}}. Do not share this code.",
  },
  {
    name: "Access Account Approved",
    channel: "SMS + Email",
    trigger: "Access account approved",
    body: "Your Kapāpala Access Account has been approved. Access ID: {{accessId}}. You may now request daily access.",
  },
  {
    name: "Needs More Information",
    channel: "Email",
    trigger: "Admin requests correction",
    body: "Your access account request needs additional information. Please log in and review the requested correction.",
  },
  {
    name: "Emergency Closure",
    channel: "Broadcast SMS",
    trigger: "Admin broadcast",
    body: "Kapāpala public access is closed due to {{reason}}. Do not enter until access is reopened.",
  },
];

export const notificationRules = [
  {
    audience: "Administrator",
    name: "Account request waiting over 24 hours",
    priority: "Medium",
    delivery: "Admin dashboard + optional email",
  },
  {
    audience: "Administrator",
    name: "SMS delivery failed",
    priority: "High",
    delivery: "Admin dashboard alert",
  },
  {
    audience: "User",
    name: "Access account expires in 30 days",
    priority: "Medium",
    delivery: "SMS + email",
  },
  {
    audience: "User",
    name: "Gate combination changed after approval",
    priority: "High",
    delivery: "SMS",
  },
];

export const configurationItems = [
  { group: "Gates", item: "Gate names", value: "Wood Valley, Honanui, ʻĀinapō" },
  { group: "Purposes", item: "Request purposes", value: "Hunting, Hiking, Cultural Access, Research, Property Access, Other" },
  { group: "Organizations", item: "Registered organizations", value: "DLNR, NPS, Research Teams, Volunteers, Contractors" },
  { group: "System", item: "Default timezone", value: "Pacific/Honolulu" },
  { group: "Security", item: "Admin MFA", value: "Required before production" },
];
