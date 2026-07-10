import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getSupabaseUserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Safe to ignore in this route.
        }
      },
    },
  });
}

async function getAuthenticatedUser(request: Request) {
  const supabaseUser = await getSupabaseUserClient();

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "").trim()
    : null;

  if (bearerToken) {
    return supabaseUser.auth.getUser(bearerToken);
  }

  return supabaseUser.auth.getUser();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accessAccountId } = await context.params;

    const supabaseAdmin = getSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await getAuthenticatedUser(request);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "You must be logged in." },
        { status: 401 }
      );
    }

    const { data: actorAccount, error: actorError } = await supabaseAdmin
      .from("access_accounts")
      .select("id, profile_id, applicant_email, app_role")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (actorError) {
      return NextResponse.json(
        { success: false, error: actorError.message },
        { status: 500 }
      );
    }

    const actorRole = actorAccount?.app_role?.toLowerCase();

    if (actorRole !== "admin" && actorRole !== "super_user") {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("access_accounts")
      .select(
        `
        id,
        applicant_first_name,
        applicant_last_name,
        applicant_email,
        id_document_path
      `
      )
      .eq("id", accessAccountId)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json(
        { success: false, error: accountError.message },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Access account not found." },
        { status: 404 }
      );
    }

    if (!account.id_document_path) {
      return NextResponse.json({
        success: true,
        hasDocument: false,
        signedUrl: null,
        expiresInSeconds: 0,
        account,
      });
    }

    const { data: signedData, error: signedError } =
      await supabaseAdmin.storage
        .from("kapapala-documents")
        .createSignedUrl(account.id_document_path, 300);

    if (signedError) {
      return NextResponse.json(
        { success: false, error: signedError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      hasDocument: true,
      signedUrl: signedData.signedUrl,
      expiresInSeconds: 300,
      account,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}