import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await context.params;

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: document, error: documentError } = await (supabase as any)
      .from("access_account_documents")
      .select("storage_bucket, storage_path")
      .eq("id", documentId)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { success: false, error: documentError?.message || "Document not found." },
        { status: 404 }
      );
    }

    const { data, error } = await (supabase as any).storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 60 * 5);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}