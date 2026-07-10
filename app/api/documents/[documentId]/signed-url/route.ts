import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase admin client is not configured.",
        },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: document, error: documentError } = await (supabase as any)
      .from("access_account_documents")
      .select("id, storage_bucket, storage_path")
      .eq("id", documentId)
      .maybeSingle();

    if (documentError) {
      return NextResponse.json(
        {
          success: false,
          error: documentError.message,
        },
        { status: 500 }
      );
    }

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error: "Document record not found.",
        },
        { status: 404 }
      );
    }

    if (!document.storage_path) {
      return NextResponse.json(
        {
          success: false,
          error: "Document storage path is missing.",
        },
        { status: 404 }
      );
    }

    const bucketName = document.storage_bucket || "kapapala-documents";

    const { data: signedData, error: signedUrlError } = await (
      supabase as any
    ).storage
      .from(bucketName)
      .createSignedUrl(document.storage_path, 60 * 5);

    if (signedUrlError) {
      return NextResponse.json(
        {
          success: false,
          error: signedUrlError.message,
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
      signedUrl: signedData.signedUrl,
      expiresInSeconds: 60 * 5,
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
