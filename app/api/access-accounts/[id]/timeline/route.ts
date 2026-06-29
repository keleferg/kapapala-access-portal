import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
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

    const supabase = getSupabaseAdmin();

    const { data, error } = await (supabase as any)
      .from("timeline_events")
      .select("id,event_type,event_title,event_body,created_at")
      .eq("access_account_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      events: data ?? [],
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