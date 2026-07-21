import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      firstName,
      lastName,
      email,
      phone,
      deviceType,
      organization,
      defaultGate,
      emergencyContactName,
      emergencyContactPhone,
    } = body;

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing authorization header.",
        },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: userError?.message || "Unable to verify user.",
        },
        { status: 401 }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from("access_accounts")
      .select("id, profile_id")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        {
          success: false,
          error: accountError?.message || "Access account not found.",
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
        organization: organization || null,
        device_type: deviceType || null,
        default_gate: defaultGate || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (accountUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error: accountUpdateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Unable to update my access account:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update my access account.",
      },
      { status: 500 }
    );
  }
}