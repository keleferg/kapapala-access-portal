export type WorkflowEventType =
  | "account.submitted"
  | "account.review_started"
  | "account.needs_info"
  | "account.approved"
  | "account.activated"
  | "daily_request.submitted"
  | "daily_request.validated"
  | "daily_request.approved"
  | "sms.sent"
  | "sms.failed";

export interface WorkflowEvent {
  type: WorkflowEventType;
  actorId: string;
  entityType: "access_account" | "daily_request" | "gate" | "system";
  entityId: string;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export function buildTimelineEvent(event: WorkflowEvent) {
  return {
    event_type: event.type,
    actor_id: event.actorId,
    entity_type: event.entityType,
    entity_id: event.entityId,
    message: event.message,
    metadata: event.metadata ?? {},
    created_at: new Date().toISOString(),
  };
}

export function shouldRouteDailyRequestToReview(input: {
  partySize: number;
  gate: string;
  purpose: string;
  overnight: boolean;
  hasPermitNumber?: boolean;
}) {
  if (input.partySize > 10) return "Party size exceeds automatic approval threshold.";
  if (input.overnight && !input.hasPermitNumber) return "Overnight access requires a summit permit number.";
  if (input.gate === "ʻĀinapō" && input.purpose === "Other") return "ʻĀinapō other-purpose requests require administrator review.";
  return null;
}
