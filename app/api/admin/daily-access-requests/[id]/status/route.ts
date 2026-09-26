import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

type RequestStatus = "pending" | "approved" | "held" | "denied" | "cancelled";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      status?: RequestStatus;
      adminNotes?: string;
    };

    if (!body.status || !["pending", "approved", "held", "denied", "cancelled"].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: "Invalid request status." },
        { status: 400 }
      );
    }

    const reason = body.adminNotes?.trim() || "";
    if (body.status === "cancelled" && !reason) {
      return NextResponse.json(
        { success: false, error: "A cancellation reason is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existing, error: existingError } = await (supabase as any)
      .from("daily_access_requests")
      .select(`
        id,
        status,
        request_date,
        access_account_id,
        gates ( name )
      `)
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { success: false, error: existingError?.message || "Request not found." },
        { status: 404 }
      );
    }

    if (body.status === "cancelled" && existing.status !== "approved") {
      return NextResponse.json(
        { success: false, error: "Only approved requests can be cancelled." },
        { status: 409 }
      );
    }

    const { data, error } = await (supabase as any)
      .from("daily_access_requests")
      .update({
        status: body.status,
        admin_notes: body.adminNotes ?? null,
        approved_at: body.status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    let notificationWarning: string | null = null;

    if (body.status === "cancelled") {
      if (existing.access_account_id) {
        await (supabase as any).from("timeline_events").insert({
          access_account_id: existing.access_account_id,
          event_type: "daily_access_request_cancelled",
          event_title: "Daily Access Request Cancelled",
          event_body: `Access request for ${existing.request_date} was cancelled. Reason: ${reason}`,
        });
      }

      const { error: notificationError } = await supabase.functions.invoke(
        "send-access-request-cancellation",
        {
          body: {
            request_id: id,
            reason,
          },
        }
      );

      if (notificationError) {
        console.error("Cancellation notification failed:", notificationError);
        notificationWarning =
          "The request was cancelled, but the user notification could not be sent.";
      }
    }

    return NextResponse.json({
      success: true,
      request: data,
      notificationWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
