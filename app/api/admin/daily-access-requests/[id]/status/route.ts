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

    const supabase = getSupabaseAdmin();

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

    return NextResponse.json({ success: true, request: data });
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