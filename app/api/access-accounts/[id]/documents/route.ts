import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await (supabase as any)
      .from("access_account_documents")
      .select(`
        id,
        document_type,
        original_filename,
        mime_type,
        file_size,
        uploaded_at,
        expires_at
      `)
      .eq("access_account_id", id)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documents: data ?? [],
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const expiresAt = formData.get("expiresAt");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file uploaded." },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Only JPG, PNG, or PDF files are allowed." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const extension = file.name.split(".").pop() || "upload";
    const storagePath = `${id}/driver-license-${Date.now()}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await (supabase as any).storage
      .from("kapapala-documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    const documentExpiration =
      typeof expiresAt === "string" && expiresAt ? expiresAt : null;

    const { data, error: dbError } = await (supabase as any)
      .from("access_account_documents")
      .insert({
        access_account_id: id,
        document_type: "Driver License",
        storage_bucket: "kapapala-documents",
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        expires_at: documentExpiration,
      })
      .select("*")
      .single();

    if (dbError) {
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    if (documentExpiration) {
      await (supabase as any)
        .from("access_accounts")
        .update({
          id_expires_at: documentExpiration,
        })
        .eq("id", id);
    }

    await (supabase as any).from("timeline_events").insert({
      access_account_id: id,
      event_type: "driver_license_uploaded",
      event_title: "Driver License Uploaded",
      event_body: `${file.name} was uploaded to the access account.`,
    });

    return NextResponse.json({
      success: true,
      document: data,
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