import { NextRequest } from "next/server";
import { POST as activateAccount } from "../activate/route";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Compatibility approval endpoint.
 *
 * All account approvals are routed through the canonical activation workflow,
 * which assigns the Access ID, activates the account, creates/links the auth
 * user, and sends the approval welcome email.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return activateAccount(request, context);
}
