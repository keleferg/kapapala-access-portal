import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function requireSyncSecret(request: Request) {
  const expectedSecret = process.env.SHAREPOINT_SYNC_SECRET;
  const providedSecret = request.headers.get("x-sharepoint-sync-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    throw new Error("Unauthorized SharePoint sync request.");
  }
}

function normalizeStatus(status: string | null | undefined) {
  if (!status) return "pending";

  const normalized = status.toLowerCase().trim();

  if (normalized === "approved") return "active";
  if (normalized === "active") return "active";
  if (normalized === "pending") return "pending";
  if (normalized === "suspended") return "suspended";
  if (normalized === "expired") return "expired";

  return "pending";
}

async function findAuthUserByEmail(supabase: any, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.users.find(
    (user: any) => user.email?.toLowerCase() === email.toLowerCase()
  );
}

export async function POST(request: Request) {
  try {
    requireSyncSecret(request);

    const body = await request.json();
    const supabase = getSupabaseAdminClient();

    const sharepointItemId = Number(body.sharepointItemId);

    if (!sharepointItemId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing SharePoint item ID.",
        },
        { status: 400 }
      );
    }

    const email = body.email ? String(body.email).trim().toLowerCase() : null;

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing email. Email is required to match or create a profile.",
        },
        { status: 400 }
      );
    }

    const firstName = body.firstName ? String(body.firstName).trim() : null;
    const lastName = body.lastName ? String(body.lastName).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const now = new Date().toISOString();

    /*
      Step 1:
      Find existing profile by email.
      If it exists, use that profile and do not overwrite admin fields.
    */
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id, is_admin, role")
      .eq("email", email)
      .maybeSingle();

    if (profileLookupError) {
      return NextResponse.json(
        {
          success: false,
          error: profileLookupError.message,
        },
        { status: 500 }
      );
    }

    let profileId = existingProfile?.id as string | undefined;

    /*
      Step 2:
      If no profile exists, create or find the Supabase Auth user first.
      profiles.id has a foreign key to auth.users.id, so profile id must
      match a real auth user id.
    */
    if (!profileId) {
      let authUser = await findAuthUserByEmail(supabase, email);

      if (!authUser) {
        const temporaryPassword = crypto.randomUUID();

        const { data: createdAuthUser, error: authCreateError } =
          await supabase.auth.admin.createUser({
            email,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: {
              first_name: firstName,
              last_name: lastName,
              phone,
              source_system: "sharepoint",
              sharepoint_item_id: sharepointItemId,
            },
          });

        if (authCreateError || !createdAuthUser.user) {
          return NextResponse.json(
            {
              success: false,
              error:
                authCreateError?.message || "Unable to create auth user.",
            },
            { status: 500 }
          );
        }

        authUser = createdAuthUser.user;
      }

      profileId = authUser.id;

      /*
        Use upsert because some auth triggers may already create a profile.
        Do not set role here because your user_role enum does not accept "user".
        Let the database default handle role.
      */
      const { error: profileUpsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: profileId,
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            is_admin: false,
            created_at: now,
            updated_at: now,
          },
          {
            onConflict: "id",
          }
        );

      if (profileUpsertError) {
        return NextResponse.json(
          {
            success: false,
            error: profileUpsertError.message,
          },
          { status: 500 }
        );
      }
    } else {
      /*
        Existing profile:
        Update contact information only.
        Do not overwrite role or is_admin.
      */
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          updated_at: now,
        })
        .eq("id", profileId);

      if (profileUpdateError) {
        return NextResponse.json(
          {
            success: false,
            error: profileUpdateError.message,
          },
          { status: 500 }
        );
      }
    }

    /*
      Step 3:
      Check if this SharePoint item already exists in Supabase.
      If the record has been converted to source_system = 'supabase',
      do not allow SharePoint to overwrite it.
    */
    const { data: existingAccount, error: accountLookupError } = await supabase
      .from("access_accounts")
      .select("id, source_system")
      .eq("sharepoint_item_id", sharepointItemId)
      .maybeSingle();

    if (accountLookupError) {
      return NextResponse.json(
        {
          success: false,
          error: accountLookupError.message,
        },
        { status: 500 }
      );
    }

    if (existingAccount?.source_system === "supabase") {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason:
          "This record is now managed by Supabase and was not overwritten by SharePoint.",
        sharepointItemId,
      });
    }

    /*
      Step 4:
      Upsert access account using SharePoint item ID.
      This lets SharePoint update the same imported record until the record
      is later converted to native Supabase ownership.
    */
    const accountPayload: Record<string, unknown> = {
      sharepoint_item_id: sharepointItemId,
      sharepoint_last_synced_at: now,
      source_system: "sharepoint",

      profile_id: profileId,
      access_id: body.accessId ? String(body.accessId).trim() : null,
      status: normalizeStatus(body.status),
      default_gate: body.defaultGate ? String(body.defaultGate).trim() : null,
      organization: body.organization ? String(body.organization).trim() : null,
      emergency_contact_name: body.emergencyContactName
        ? String(body.emergencyContactName).trim()
        : null,
      emergency_contact_phone: body.emergencyContactPhone
        ? String(body.emergencyContactPhone).trim()
        : null,
      updated_at: now,
    };

    if (!existingAccount) {
      accountPayload.migrated_at = now;
    }

    const { error: accountUpsertError } = await supabase
      .from("access_accounts")
      .upsert(accountPayload, {
        onConflict: "sharepoint_item_id",
      });

    if (accountUpsertError) {
      return NextResponse.json(
        {
          success: false,
          error: accountUpsertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      skipped: false,
      sharepointItemId,
    });
  } catch (error) {
    console.error("SharePoint access account sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "SharePoint access account sync failed.",
      },
      { status: 500 }
    );
  }
}