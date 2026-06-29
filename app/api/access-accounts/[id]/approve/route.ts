import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

async function generateAccessId(supabase: any) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = String(randomInt(1, 99999)).padStart(5, "0");

    const { data, error } = await supabase
      .from("access_accounts")
      .select("id")
      .eq("access_id", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique Access ID.");
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const params = await context.params;
    const accountId = params.id;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "Missing access account ID." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const accessId = await generateAccessId(supabase);
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);

    const { data: account, error } = await (supabase as any)
      .from("access_accounts")
      .update({
        status: "active",
        access_id: accessId,
        issued_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString().slice(0, 10),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select("id, access_id, status")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    await (supabase as any).from("timeline_events").insert({
      access_account_id: accountId,
      event_type: "access_account_approved",
      event_title: "Access Account Approved",
      event_body: `Access account approved and Access ID ${accessId} issued.`,
    });

    return NextResponse.json({
      success: true,
      account,
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