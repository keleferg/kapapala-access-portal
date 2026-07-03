import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

type AccessAccountPayload = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  organization?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  defaultGate?: "Wood Valley" | "Honanui" | "ʻĀinapō";
  vehicles?: {
    label?: string;
    licensePlate: string;
    state?: string;
    make?: string;
    model?: string;
    color?: string;
    isDefault?: boolean;
  }[];
};

export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as AccessAccountPayload;

    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return NextResponse.json(
        { success: false, error: "First name and last name are required." },
        { status: 400 }
      );
    }

    if (!body.email?.trim()) {
      return NextResponse.json(
        { success: false, error: "Email is required for this test workflow." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const tempPassword = `Kapapala-${crypto.randomUUID()}!`;

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: body.email.trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: body.firstName.trim(),
          last_name: body.lastName.trim(),
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: authError?.message || "Unable to create auth user.",
        },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await (supabase as any)
      .from("profiles")
      .upsert({
        id: userId,
        first_name: body.firstName.trim(),
        last_name: body.lastName.trim(),
        email: body.email.trim(),
        phone: body.phone?.trim() || null,
        role: "public_user",
      })
      .select("id")
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          error: profileError?.message || "Unable to create profile.",
        },
        { status: 500 }
      );
    }

    const { data: account, error: accountError } = await (supabase as any)
      .from("access_accounts")
      .insert({
        profile_id: profile.id,
        status: "pending",
        account_type: "Public Access",
        organization: body.organization?.trim() || null,
        default_gate: body.defaultGate || null,
        emergency_contact_name: body.emergencyContactName?.trim() || null,
        emergency_contact_phone: body.emergencyContactPhone?.trim() || null,
      })
      .select("id, status, created_at")
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        {
          success: false,
          error: accountError?.message || "Unable to create access account.",
        },
        { status: 500 }
      );
    }

    if (body.vehicles?.length) {
      const vehicles = body.vehicles
        .filter((vehicle) => vehicle.licensePlate?.trim())
        .map((vehicle, index) => ({
          access_account_id: account.id,
          label:
            vehicle.label?.trim() ||
            `${vehicle.color || ""} ${vehicle.make || ""} ${
              vehicle.model || ""
            }`.trim() ||
            "Vehicle",
          license_plate: vehicle.licensePlate.trim(),
          state: vehicle.state?.trim() || "HI",
          make: vehicle.make?.trim() || null,
          model: vehicle.model?.trim() || null,
          color: vehicle.color?.trim() || null,
          is_default: vehicle.isDefault ?? index === 0,
        }));

      if (vehicles.length) {
        const { error: vehicleError } = await (supabase as any)
          .from("vehicles")
          .insert(vehicles);

        if (vehicleError) {
          return NextResponse.json(
            { success: false, error: vehicleError.message },
            { status: 500 }
          );
        }
      }
    }

    await (supabase as any).from("timeline_events").insert({
      access_account_id: account.id,
      event_type: "access_account_submitted",
      event_title: "Access Account Application Submitted",
      event_body: `${body.firstName.trim()} ${body.lastName.trim()} submitted an access account application.`,
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

export async function GET() {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await (supabase as any)
      .from("access_accounts")
      .select(
        `
        id,
        access_id,
        status,
        account_type,
        organization,
        default_gate,
        emergency_contact_name,
        emergency_contact_phone,
        created_at,
        updated_at,
        internal_notes,
        applicant:profiles!access_accounts_profile_id_fkey (
          first_name,
          last_name,
          email,
          phone
        ),
        reviewer:profiles!access_accounts_reviewed_by_fkey (
          first_name,
          last_name,
          email
        ),
        vehicles (
          id,
          label,
          license_plate,
          state,
          make,
          model,
          color,
          is_default
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      accounts: data ?? [],
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