import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      gateName?: string;
      requestDate?: string;
      reason?: string;
    };

    const gateName = body.gateName?.trim() || "";
    const requestDate = body.requestDate?.trim() || "";
    const reason = body.reason?.trim() || "";

    if (!gateName || !/^\d{4}-\d{2}-\d{2}$/.test(requestDate) || !reason) {
      return NextResponse.json(
        { success: false, error: "Gate, date, and cancellation reason are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: gate, error: gateError } = await (supabase as any)
      .from("gates")
      .select("id, name")
      .eq("name", gateName)
      .single();

    if (gateError || !gate) {
      return NextResponse.json(
        { success: false, error: gateError?.message || "Gate not found." },
        { status: 404 }
      );
    }

    if (reason.toLowerCase() === String(gate.name).trim().toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The cancellation reason cannot be only the gate name. Enter the actual reason for the cancellation.",
        },
        { status: 400 }
      );
    }

    const { data: targets, error: targetError } = await (supabase as any)
      .from("daily_access_requests")
      .select("id, access_account_id, request_date")
      .eq("gate_id", gate.id)
      .eq("request_date", requestDate)
      .eq("status", "approved");

    if (targetError) {
      return NextResponse.json(
        { success: false, error: targetError.message },
        { status: 500 }
      );
    }

    const rows = targets ?? [];
    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "There are no approved requests for that gate and date." },
        { status: 409 }
      );
    }

    const ids = rows.map((row: any) => row.id);

    const { error: updateError } = await (supabase as any)
      .from("daily_access_requests")
      .update({
        status: "cancelled",
        admin_notes: reason,
        approved_at: null,
      })
      .in("id", ids)
      .eq("status", "approved");

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    const timelineRows = rows
      .filter((row: any) => row.access_account_id)
      .map((row: any) => ({
        access_account_id: row.access_account_id,
        event_type: "daily_access_request_cancelled",
        event_title: "Daily Access Request Cancelled",
        event_body: `Access request for ${requestDate} through ${gate.name} was cancelled. Reason: ${reason}`,
      }));

    if (timelineRows.length) {
      await (supabase as any).from("timeline_events").insert(timelineRows);
    }

    let notificationFailures = 0;
    for (const row of rows) {
      const { error } = await supabase.functions.invoke(
        "send-access-request-cancellation",
        { body: { request_id: row.id, reason } }
      );
      if (error) {
        notificationFailures += 1;
        console.error("Bulk cancellation notification failed:", row.id, error);
      }
    }

    return NextResponse.json({
      success: true,
      cancelledCount: rows.length,
      notificationFailures,
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
