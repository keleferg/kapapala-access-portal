import { randomUUID } from "node:crypto";
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

    const isDirectUpload = request.headers.get("content-type")?.includes("application/json");
    const payload = isDirectUpload ? await request.json() : null;
    const formData = isDirectUpload ? null : await request.formData();
    const file = formData?.get("file");
    const fileName = isDirectUpload ? payload.fileName : file instanceof File ? file.name : null;
    let mimeType = isDirectUpload ? payload.mimeType : file instanceof File ? file.type : null;
    let fileSize = isDirectUpload ? payload.fileSize : file instanceof File ? file.size : null;
    const requestedDocumentType = isDirectUpload ? payload.documentType : formData?.get("documentType");
    if (typeof fileName !== "string" || !fileName || fileName.length > 255 ||
        !allowedMimeTypes.has(mimeType) || !Number.isInteger(fileSize) ||
        fileSize <= 0 || fileSize > 5 * 1024 * 1024 ||
        !allowedDocumentTypes.has(requestedDocumentType)) {
      return NextResponse.json({ success: false, error: "Select an ID type and a JPG or PNG file no larger than 5 MB." }, { status: 400 });
    }
    const documentType = requestedDocumentType as string;

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

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    let storagePath = `${account.id}/replacement-id-${randomUUID()}-${safeName}`;
    const bucket = supabase.storage.from("access-account-ids");
    if (isDirectUpload) {
      if (payload.action === "prepare") {
        const { data, error } = await bucket.createSignedUploadUrl(storagePath);
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, storagePath, token: data.token });
      }
      if (payload.action !== "complete" || typeof payload.storagePath !== "string" ||
          !payload.storagePath.startsWith(`${account.id}/replacement-id-`) ||
          payload.storagePath.includes("..") || payload.storagePath.split("/").length !== 2) {
        return NextResponse.json({ success: false, error: "Invalid upload path." }, { status: 400 });
      }
      storagePath = payload.storagePath;
      const { data: stored, error } = await bucket.info(storagePath);
      if (error || !stored) throw new Error("The ID upload is incomplete. Please try again.");
      mimeType = stored.contentType;
      fileSize = stored.size;
      if (!allowedMimeTypes.has(mimeType ?? "") || !fileSize || fileSize > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: "The uploaded ID must be a JPG or PNG no larger than 5 MB." }, { status: 400 });
      }
    } else {
      const { error } = await bucket.upload(storagePath, Buffer.from(await (file as File).arrayBuffer()), {
        contentType: mimeType, upsert: false,
      });
      if (error) throw new Error(error.message);
    }

    const { data: document, error: documentError } = await supabase
      .from("access_account_documents")
      .insert({
        access_account_id: account.id,
        document_type: documentType,
        storage_bucket: "access-account-ids",
        storage_path: storagePath,
        original_filename: fileName,
        mime_type: mimeType,
        file_size: fileSize,
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
