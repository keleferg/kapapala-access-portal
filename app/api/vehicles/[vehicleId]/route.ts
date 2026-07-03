import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ vehicleId: string }> }
) {
  try {
    const { vehicleId } = await context.params;

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: vehicle } = await (supabase as any)
      .from("vehicles")
      .select("id,access_account_id,label,license_plate")
      .eq("id", vehicleId)
      .single();

    const { error } = await (supabase as any)
      .from("vehicles")
      .delete()
      .eq("id", vehicleId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (vehicle?.access_account_id) {
      await (supabase as any).from("timeline_events").insert({
        access_account_id: vehicle.access_account_id,
        event_type: "vehicle_removed",
        event_title: "Vehicle Removed",
        event_body: `${vehicle.label} / ${vehicle.license_plate} was removed.`,
      });
    }

    return NextResponse.json({ success: true });
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