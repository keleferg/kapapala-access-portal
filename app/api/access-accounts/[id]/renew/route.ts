import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

export async function POST(
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

    const newExpiration = new Date();
    newExpiration.setFullYear(newExpiration.getFullYear() + 2);

    const { data, error } = await (supabase as any)
      .from("access_accounts")
      .update({
        status: "active",
        expires_at: newExpiration.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, access_id, status, expires_at")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    await (supabase as any).from("timeline_events").insert({
      access_account_id: id,
      event_type: "access_account_renewed",
      event_title: "Access Account Renewed",
      event_body: `Access account renewed through ${newExpiration
        .toISOString()
        .slice(0, 10)}.`,
    });

    return NextResponse.json({ success: true, account: data });
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