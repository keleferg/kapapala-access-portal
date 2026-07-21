import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const allowedDocumentTypes = new Set([
  "Driver License",
  "State ID",
  "Passport",
  "Other Government ID",
]);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing authorization.",
        },
        { status: 401 }
      );
    }

    const token = authHeader.slice("Bearer ".length);
    const supabase = getSupabaseAdmin();

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

    const formData = await request.formData();
    const file = formData.get("file");
    const requestedDocumentType = formData.get("documentType");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please select an identification document.",
        },
        { status: 400 }
      );
    }

    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Only JPG, PNG, and PDF files are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "The identification file must be 15 MB or smaller.",
        },
        { status: 400 }
      );
    }

    const documentType =
      typeof requestedDocumentType === "string" &&
      allowedDocumentTypes.has(requestedDocumentType)
        ? requestedDocumentType
        : "Other Government ID";

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

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath =
      `${account.id}/replacement-id-${Date.now()}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("access-account-ids")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          success: false,
          error: uploadError.message,
        },
        { status: 500 }
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("access_account_documents")
      .insert({
        access_account_id: account.id,
        document_type: documentType,
        storage_bucket: "access-account-ids",
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
      })
      .select("id, storage_path")
      .single();

    if (documentError || !document) {
      await supabase.storage
        .from("access-account-ids")
        .remove([storagePath]);

      return NextResponse.json(
        {
          success: false,
          error:
            documentError?.message ||
            "Unable to register the identification document.",
        },
        { status: 500 }
      );
    }

    const { error: accountUpdateError } = await supabase
      .from("access_accounts")
      .update({
        id_document_path: storagePath,
        id_review_status: "not_checked",
        id_review_flags: [],
        latest_id_document_review_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .eq("profile_id", user.id);

    if (accountUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error: accountUpdateError.message,
        },
        { status: 500 }
      );
    }

    await supabase.from("timeline_events").insert({
      access_account_id: account.id,
      event_type: "identification_reuploaded",
      event_title: "Identification Reuploaded",
      event_body:
        `${documentType} uploaded during existing-account setup.`,
    });

    return NextResponse.json({
      success: true,
      storagePath,
      documentId: document.id,
    });
  } catch (error) {
    console.error("Unable to upload replacement identification:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload identification.",
      },
      { status: 500 }
    );
  }
}
