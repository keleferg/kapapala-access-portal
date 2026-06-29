import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { success: false, error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { error } = await (supabase as any)
    .from("access_accounts")
    .update({ status: "active" })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  await (supabase as any).from("timeline_events").insert({
    access_account_id: id,
    event_type: "access_account_reactivated",
    event_title: "Access Account Reactivated",
    event_body: "The access account was reactivated by an administrator.",
  });

  return NextResponse.json({ success: true });
}