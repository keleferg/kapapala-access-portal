import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: accountId } = await context.params;
    const body = await request.json();

    const supabase = getSupabaseAdminClient();

    const {
      firstName,
      lastName,
      email,
      phone,
      deviceType,
      accessId,
      status,
      defaultGate,
      organization,
      emergencyContactName,
      emergencyContactPhone,
    } = body;

    const { data: account, error: accountLoadError } = await supabase
      .from("access_accounts")
      .select("id, profile_id")
      .eq("id", accountId)
      .single();

    if (accountLoadError || !account) {
      return NextResponse.json(
        {
          success: false,
          error: accountLoadError?.message || "Access account not found.",
        },
        { status: 404 }
      );
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        email: email || null,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.profile_id);

    if (profileUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error: profileUpdateError.message,
        },
        { status: 500 }
      );
    }

    const { error: accountUpdateError } = await supabase
      .from("access_accounts")
      .update({
        access_id: accessId || null,
        status: status || "pending",
        default_gate: defaultGate || null,
        organization: organization || null,
        device_type: deviceType || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (accountUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error: accountUpdateError.message,
        },
        { status: 500 }
      );
    }

    await supabase.from("access_account_events").insert({
      access_account_id: accountId,
      event_type: "profile_updated",
      event_title: "Account Profile Updated",
      event_body: "An administrator updated this access account profile.",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Unable to update access account profile:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update access account profile.",
      },
      { status: 500 }
    );
  }
}