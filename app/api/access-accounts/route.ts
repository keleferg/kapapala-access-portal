import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

type AccessAccountPayload = {
  applicationId?: string;
  idType?: string;
  idDocumentPath?: string;
  idDocumentOriginalFilename?: string;
  idDocumentMimeType?: string;
  idDocumentFileSize?: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  organization?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  defaultGate?: "Wood Valley" | "Honanui" | "ʻĀinapō";
  adminCreated?: boolean;
  bypassPhotoId?: boolean;
  bypassNotifications?: boolean;
  status?: "pending" | "active";
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

async function getNextAccessId(supabase: any) {
  const { data, error } = await supabase
    .from("access_accounts")
    .select("access_id")
    .not("access_id", "is", null);

  if (error) {
    throw new Error(error.message || "Unable to determine next Access ID.");
  }

  const highestAccessId = (data ?? [])
    .map((row: { access_id: string | null }) => row.access_id)
    .filter((accessId: string | null): accessId is string =>
      Boolean(accessId && /^[0-9]+$/.test(accessId))
    )
    .map((accessId: string) => Number.parseInt(accessId, 10))
    .filter((accessId: number) => Number.isFinite(accessId))
    .reduce((highest: number, accessId: number) => {
      return accessId > highest ? accessId : highest;
    }, 0);

  return String(highestAccessId + 1);
}

async function findExistingAuthUserIdByEmail(supabase: any, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    throw new Error(error.message || "Unable to look up existing user.");
  }

  const existingUser = data.users.find(
    (user: { id: string; email?: string | null }) =>
      user.email?.toLowerCase() === email.toLowerCase()
  );

  return existingUser?.id ?? null;
}

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
        { success: false, error: "Email is required." },
        { status: 400 }
      );
    }

    if (
      !body.adminCreated &&
      !body.bypassPhotoId &&
      !body.idDocumentPath?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A government ID document is required.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const normalizedEmail = body.email.trim().toLowerCase();
    const tempPassword = `Kapapala-${crypto.randomUUID()}!`;

    let userId: string | null = null;

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: body.firstName.trim(),
          last_name: body.lastName.trim(),
        },
      });

    if (authData.user) {
      userId = authData.user.id;
    }

    if (authError) {
      const alreadyRegistered =
        authError.message.toLowerCase().includes("already") ||
        authError.message.toLowerCase().includes("registered");

      if (!alreadyRegistered) {
        return NextResponse.json(
          {
            success: false,
            error: authError.message || "Unable to create auth user.",
          },
          { status: 500 }
        );
      }

      userId = await findExistingAuthUserIdByEmail(supabase, normalizedEmail);

      if (!userId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A user with this email already exists, but the matching auth account could not be found.",
          },
          { status: 500 }
        );
      }
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to determine user ID for this account.",
        },
        { status: 500 }
      );
    }

    const { data: profile, error: profileError } = await (supabase as any)
      .from("profiles")
      .upsert({
        id: userId,
        first_name: body.firstName.trim(),
        last_name: body.lastName.trim(),
        email: normalizedEmail,
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

    const { data: existingAccount, error: existingAccountError } = await (
      supabase as any
    )
      .from("access_accounts")
      .select("id, access_id, status, app_role, created_at")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existingAccountError) {
      return NextResponse.json(
        {
          success: false,
          error:
            existingAccountError.message ||
            "Unable to check for existing access account.",
        },
        { status: 500 }
      );
    }

    let account = existingAccount;

    if (!account) {
      const nextAccessId = await getNextAccessId(supabase);

      const { data: newAccount, error: accountError } = await (supabase as any)
        .from("access_accounts")
        .insert({
          profile_id: profile.id,
          access_id: nextAccessId,
          status: body.adminCreated ? "active" : body.status || "pending",
          app_role: "user",
          account_type: "Public Access",
          applicant_first_name: body.firstName.trim(),
          applicant_last_name: body.lastName.trim(),
          applicant_email: normalizedEmail,
          applicant_phone: body.phone?.trim() || null,
          organization: body.organization?.trim() || null,
          default_gate: body.defaultGate || null,
          emergency_contact_name: body.emergencyContactName?.trim() || null,
          emergency_contact_phone: body.emergencyContactPhone?.trim() || null,
        })
        .select("id, access_id, status, app_role, created_at")
        .single();

      if (accountError || !newAccount) {
        return NextResponse.json(
          {
            success: false,
            error: accountError?.message || "Unable to create access account.",
          },
          { status: 500 }
        );
      }

      account = newAccount;
    } else if (!account.access_id) {
      const nextAccessId = await getNextAccessId(supabase);

      const { data: updatedAccount, error: updateAccountError } = await (
        supabase as any
      )
        .from("access_accounts")
        .update({
          access_id: nextAccessId,
          status: body.adminCreated ? "active" : account.status,
          app_role: account.app_role || "user",
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)
        .select("id, access_id, status, app_role, created_at")
        .single();

      if (updateAccountError || !updatedAccount) {
        return NextResponse.json(
          {
            success: false,
            error:
              updateAccountError?.message ||
              "Unable to assign Access ID to existing account.",
          },
          { status: 500 }
        );
      }

      account = updatedAccount;
    }

    if (account?.id) {
      const { data: hydratedAccount, error: hydrateAccountError } = await (
        supabase as any
      )
        .from("access_accounts")
        .update({
          applicant_first_name: body.firstName.trim(),
          applicant_last_name: body.lastName.trim(),
          applicant_email: normalizedEmail,
          applicant_phone: body.phone?.trim() || null,
          organization: body.organization?.trim() || null,
          default_gate: body.defaultGate || null,
          emergency_contact_name:
            body.emergencyContactName?.trim() || null,
          emergency_contact_phone:
            body.emergencyContactPhone?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)
        .select("id, access_id, status, app_role, created_at")
        .single();

      if (hydrateAccountError || !hydratedAccount) {
        return NextResponse.json(
          {
            success: false,
            error:
              hydrateAccountError?.message ||
              "Unable to save applicant information.",
          },
          { status: 500 }
        );
      }

      account = hydratedAccount;
    }

    if (body.idDocumentPath?.trim() && account?.id) {
      const storagePath = body.idDocumentPath.trim();
      const applicationId = body.applicationId?.trim() || "";
      const expectedPrefix = applicationId
        ? `pending/${applicationId}-`
        : "pending/";

      if (!storagePath.startsWith(expectedPrefix)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid government ID storage path.",
          },
          { status: 400 }
        );
      }

      const { data: existingDocument, error: existingDocumentError } =
        await (supabase as any)
          .from("access_account_documents")
          .select("id, access_account_id")
          .eq("storage_bucket", "access-account-ids")
          .eq("storage_path", storagePath)
          .maybeSingle();

      if (existingDocumentError) {
        return NextResponse.json(
          {
            success: false,
            error: existingDocumentError.message,
          },
          { status: 500 }
        );
      }

      if (
        existingDocument &&
        existingDocument.access_account_id !== account.id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This government ID document is already linked to another account.",
          },
          { status: 409 }
        );
      }

      if (!existingDocument) {
        const originalFilename =
          body.idDocumentOriginalFilename?.trim() ||
          storagePath.split("/").pop() ||
          "government-id";

        const fileSize =
          typeof body.idDocumentFileSize === "number" &&
          Number.isFinite(body.idDocumentFileSize)
            ? Math.max(0, Math.trunc(body.idDocumentFileSize))
            : null;

        const { error: documentInsertError } = await (supabase as any)
          .from("access_account_documents")
          .insert({
            access_account_id: account.id,
            document_type: "government_id",
            storage_bucket: "access-account-ids",
            storage_path: storagePath,
            original_filename: originalFilename,
            mime_type:
              body.idDocumentMimeType?.trim() || null,
            file_size: fileSize,
            notes: body.idType?.trim()
              ? `Government ID type: ${body.idType.trim()}`
              : null,
          });

        if (documentInsertError) {
          return NextResponse.json(
            {
              success: false,
              error:
                documentInsertError.message ||
                "Unable to link the government ID document.",
            },
            { status: 500 }
          );
        }
      }

      const { error: legacyPathError } = await (supabase as any)
        .from("access_accounts")
        .update({
          id_document_path: storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      if (legacyPathError) {
        return NextResponse.json(
          {
            success: false,
            error:
              legacyPathError.message ||
              "Unable to save the government ID path.",
          },
          { status: 500 }
        );
      }
    }

    if (body.vehicles?.length && account?.id) {
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
      event_type: body.adminCreated
        ? "access_account_admin_created"
        : "access_account_submitted",
      event_title: body.adminCreated
        ? "Access Account Created by Administrator"
        : "Access Account Application Submitted",
      event_body: body.adminCreated
        ? `${body.firstName.trim()} ${body.lastName.trim()} was added directly by an administrator.`
        : `${body.firstName.trim()} ${body.lastName.trim()} submitted an access account application.`,
    });

    if (!body.adminCreated && !body.bypassNotifications) {
      const { error: confirmationEmailError } =
        await supabase.functions.invoke("send-submission-confirmation", {
          body: {
            access_account_id: account.id,
          },
        });

      if (confirmationEmailError) {
        console.error(
          "Submission confirmation email failed:",
          confirmationEmailError
        );
      }
    }

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
        profile_id,
        status,
        app_role,
        account_type,
        organization,
        default_gate,
        emergency_contact_name,
        emergency_contact_phone,
        created_at,
        updated_at,
        internal_notes,

        applicant_first_name,
        applicant_last_name,
        applicant_email,
        applicant_phone,

        source_system,
        sharepoint_item_id,
        sharepoint_last_synced_at,
        sharepoint_last_modified,
        sharepoint_sync_status,

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

    const accounts = (data ?? []).map((account: any) => {
      const applicantFirstName =
        account.applicant?.first_name ||
        account.applicant_first_name ||
        null;

      const applicantLastName =
        account.applicant?.last_name ||
        account.applicant_last_name ||
        null;

      const applicantEmail =
        account.applicant?.email ||
        account.applicant_email ||
        null;

      const applicantPhone =
        account.applicant?.phone ||
        account.applicant_phone ||
        null;

      return {
        ...account,
        app_role: account.app_role ?? "user",
        vehicles: account.vehicles ?? [],
        applicant_first_name: applicantFirstName,
        applicant_last_name: applicantLastName,
        applicant_email: applicantEmail,
        applicant_phone: applicantPhone,
        applicant: account.applicant ?? {
          first_name: applicantFirstName,
          last_name: applicantLastName,
          email: applicantEmail,
          phone: applicantPhone,
        },
      };
    });

    return NextResponse.json({
      success: true,
      accounts,
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