import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    if (!body.licensePlate?.trim()) {
      return NextResponse.json(
        { success: false, error: "License plate is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const label =
      body.label?.trim() ||
      `${body.color || ""} ${body.make || ""} ${body.model || ""}`.trim() ||
      "Vehicle";

    const { data, error } = await (supabase as any)
      .from("vehicles")
      .insert({
        access_account_id: id,
        label,
        license_plate: body.licensePlate.trim().toUpperCase(),
        state: body.state?.trim() || "HI",
        make: body.make?.trim() || null,
        model: body.model?.trim() || null,
        color: body.color?.trim() || null,
        is_default: Boolean(body.isDefault),
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    await (supabase as any).from("timeline_events").insert({
      access_account_id: id,
      event_type: "vehicle_added",
      event_title: "Vehicle Added",
      event_body: `${label} / ${body.licensePlate.trim().toUpperCase()} was added.`,
    });

    return NextResponse.json({ success: true, vehicle: data });
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