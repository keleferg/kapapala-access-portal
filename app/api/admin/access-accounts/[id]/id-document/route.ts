import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const SIGNED_URL_SECONDS = 60 * 5;
const LEGACY_BUCKET = "kapapala-documents";

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

      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: any;
        }>
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Safe to ignore when cookies cannot be changed here.
        }
      },
    },
  });
}

async function getAuthenticatedUser(request: Request) {
  const supabaseUser = await getSupabaseUserClient();

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
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
        {
          success: false,
          error: "You must be logged in.",
        },
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
        {
          success: false,
          error: actorError.message,
        },
        { status: 500 }
      );
    }

    const actorRole = actorAccount?.app_role?.toLowerCase();

    if (actorRole !== "admin" && actorRole !== "super_user") {
      return NextResponse.json(
        {
          success: false,
          error: "Admin access required.",
        },
        { status: 403 }
      );
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("access_accounts")
      .select(`
        id,
        applicant_first_name,
        applicant_last_name,
        applicant_email,
        id_document_path
      `)
      .eq("id", accessAccountId)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json(
        {
          success: false,
          error: accountError.message,
        },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: "Access account not found.",
        },
        { status: 404 }
      );
    }

    /*
     * New document architecture. Accept the known historical names too,
     * because older uploaded records may not all use the same label.
     */
    const { data: documents, error: documentError } = await supabaseAdmin
      .from("access_account_documents")
      .select(`
        id,
        document_type,
        storage_bucket,
        storage_path,
        original_filename,
        mime_type,
        file_size,
        uploaded_at,
        expires_at
      `)
      .eq("access_account_id", accessAccountId)
      .in("document_type", [
        "government_id",
        "Government ID",
        "driver_license",
        "Driver License",
      ])
      .order("uploaded_at", { ascending: false })
      .limit(1);

    if (documentError) {
      return NextResponse.json(
        {
          success: false,
          error: documentError.message,
        },
        { status: 500 }
      );
    }

    const document = documents?.[0] ?? null;

    if (document?.storage_path) {
      const bucketName =
        document.storage_bucket?.trim() || LEGACY_BUCKET;

      const { data: signedData, error: signedError } =
        await supabaseAdmin.storage
          .from(bucketName)
          .createSignedUrl(
            document.storage_path,
            SIGNED_URL_SECONDS
          );

      if (signedError) {
        return NextResponse.json(
          {
            success: false,
            error: signedError.message,
          },
          { status: 500 }
        );
      }

      if (!signedData?.signedUrl) {
        return NextResponse.json(
          {
            success: false,
            error: "Signed URL was not returned.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        hasDocument: true,
        signedUrl: signedData.signedUrl,
        expiresInSeconds: SIGNED_URL_SECONDS,
        source: "access_account_documents",
        document: {
          id: document.id,
          documentType: document.document_type,
          filename: document.original_filename,
          mimeType: document.mime_type,
          fileSize: document.file_size,
          uploadedAt: document.uploaded_at,
          expiresAt: document.expires_at,
          storageBucket: bucketName,
          storagePath: document.storage_path,
        },
        account,
      });
    }

    /*
     * Backward compatibility for older accounts that only populated
     * access_accounts.id_document_path.
     */
    const legacyPath =
      typeof account.id_document_path === "string"
        ? account.id_document_path.trim()
        : "";

    if (legacyPath) {
      const { data: signedData, error: signedError } =
        await supabaseAdmin.storage
          .from(LEGACY_BUCKET)
          .createSignedUrl(legacyPath, SIGNED_URL_SECONDS);

      if (signedError) {
        return NextResponse.json(
          {
            success: false,
            error: signedError.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        hasDocument: true,
        signedUrl: signedData?.signedUrl ?? null,
        expiresInSeconds: SIGNED_URL_SECONDS,
        source: "legacy_id_document_path",
        document: {
          id: null,
          documentType: "legacy_government_id",
          filename: legacyPath.split("/").pop() ?? "Government ID",
          mimeType: null,
          fileSize: null,
          uploadedAt: null,
          expiresAt: null,
          storageBucket: LEGACY_BUCKET,
          storagePath: legacyPath,
        },
        account,
      });
    }

    return NextResponse.json({
      success: true,
      hasDocument: false,
      signedUrl: null,
      expiresInSeconds: 0,
      source: null,
      document: null,
      account,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
