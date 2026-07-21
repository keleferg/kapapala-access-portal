import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";
import { processAinapoPdf } from "./processor.ts";

const BUCKET = "ainapo-permit-reports";
const ALLOWED_SENDERS = new Set([
  "operations@kapapalaranch.com",
  "operations@kapapalaranch.onmicrosoft.com",
]);

const SUBJECT_MATCHES = [
  "ainapo cabin permit report",
  "scheduled check-in's for tomorrow for ainapo",
  "scheduled check-ins for tomorrow for ainapo",
];
const MAX_PDF_BYTES = 10 * 1024 * 1024;

type ResendEmailReceivedEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string | string[];
    to?: string[];
    subject?: string;
    attachments?: Array<{
      id?: string;
      filename?: string;
      content_type?: string;
    }>;
  };
};

type ResendAttachment = {
  id: string;
  filename: string;
  content_type?: string | null;
  size?: number | null;
  download_url: string;
  expires_at?: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function normalizeEmailAddress(value: string): string {
  const angleMatch = value.match(/<([^>]+)>/);
  const address = angleMatch?.[1] ?? value;

  return address.trim().toLowerCase();
}

function senderMatches(value: string | string[] | undefined): boolean {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values.some((sender) =>
    ALLOWED_SENDERS.has(normalizeEmailAddress(sender))
  );
}

function subjectMatches(value: string | undefined): boolean {
  const normalized = (value ?? "")
    .toLowerCase()
    .replaceAll("ʻ", "")
    .replaceAll("ā", "a");

  return SUBJECT_MATCHES.some((match) => normalized.includes(match));
}

function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "ainapo-permit-report.pdf";
}

function hawaiiDate(value?: string): string {
  const date = value ? new Date(value) : new Date();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function resendGet<T>(
  path: string,
  resendApiKey: string,
): Promise<T> {
  const response = await fetch(`https://api.resend.com${path}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      accept: "application/json",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Resend API ${response.status}: ${text.slice(0, 1000)}`,
    );
  }

  return JSON.parse(text) as T;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "GET") {
    return jsonResponse({
      success: true,
      function: "process-ainapo-permit-report",
      status: "ready",
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !resendApiKey ||
    !webhookSecret ||
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    console.error("Required environment variables are missing.");

    return jsonResponse(
      { error: "Function configuration is incomplete" },
      500,
    );
  }

  /*
   * Signature verification must use the unmodified raw body.
   */
  const rawBody = await request.text();

  let event: ResendEmailReceivedEvent;

  try {
    const webhook = new Webhook(webhookSecret);

    event = webhook.verify(rawBody, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    }) as ResendEmailReceivedEvent;
  } catch (error) {
    console.error("Invalid Resend webhook signature:", error);

    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  if (event.type !== "email.received") {
    return jsonResponse({
      success: true,
      ignored: true,
      reason: "Unsupported event type",
    });
  }

  const emailId = event.data?.email_id;
  const sender = event.data?.from;
  const subject = event.data?.subject ?? "";

  if (!emailId) {
    return jsonResponse({ error: "Missing received email ID" }, 400);
  }

  if (!senderMatches(sender)) {
    console.log("Ignored email from non-DLNR sender:", sender);

    return jsonResponse({
      success: true,
      ignored: true,
      reason: "Sender not allowed",
    });
  }

  if (!subjectMatches(subject)) {
    console.log("Ignored email with unrelated subject:", subject);

    return jsonResponse({
      success: true,
      ignored: true,
      reason: "Subject does not match Ainapo permit report",
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const attachmentResponse = await resendGet<{
      object?: string;
      has_more?: boolean;
      data?: ResendAttachment[];
    }>(
      `/emails/receiving/${encodeURIComponent(emailId)}/attachments`,
      resendApiKey,
    );

    const attachments = attachmentResponse.data ?? [];

    const pdfAttachments = attachments.filter((attachment) => {
      const filename = attachment.filename?.toLowerCase() ?? "";
      const contentType = attachment.content_type?.toLowerCase() ?? "";

      return (
        contentType === "application/pdf" ||
        filename.endsWith(".pdf")
      );
    });

    if (pdfAttachments.length === 0) {
      console.error("No PDF attachment found for email:", emailId);

      return jsonResponse(
        {
          error: "No PDF attachment found",
          email_id: emailId,
        },
        422,
      );
    }

    const reportDate = hawaiiDate(event.created_at);
    const storedReports: Array<Record<string, unknown>> = [];

    for (const attachment of pdfAttachments) {
      if (
        typeof attachment.size === "number" &&
        attachment.size > MAX_PDF_BYTES
      ) {
        throw new Error(
          `PDF exceeds 10 MB limit: ${attachment.filename}`,
        );
      }

      const downloadResponse = await fetch(attachment.download_url);

      if (!downloadResponse.ok) {
        throw new Error(
          `Unable to download ${attachment.filename}: ` +
            `${downloadResponse.status}`,
        );
      }

      const pdfBytes = new Uint8Array(
        await downloadResponse.arrayBuffer(),
      );

      if (pdfBytes.byteLength > MAX_PDF_BYTES) {
        throw new Error(
          `Downloaded PDF exceeds 10 MB limit: ${attachment.filename}`,
        );
      }

      const filename = sanitizeFilename(attachment.filename);
      const storagePath =
        `${reportDate}/${emailId}/${attachment.id}-${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          `Unable to store ${filename}: ${uploadError.message}`,
        );
      }

      const senderText = Array.isArray(sender)
        ? sender.join(", ")
        : sender ?? "operations@kapapalaranch.com";

      const reportValues = {
        provider_email_id: emailId,
        sender_email: normalizeEmailAddress(senderText),
        subject,
        attachment_filename: attachment.filename,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        report_date_hst: reportDate,
        received_at: event.created_at ?? new Date().toISOString(),
        processing_status: "received",
        permit_count: 0,
        matched_request_count: 0,
        unmatched_permit_count: 0,
        last_checked_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      };

      /*
       * Handle webhook retries idempotently. Resend may retry delivery.
       */
      const { data: existingReport, error: existingError } =
        await supabase
          .from("ainapo_permit_reports")
          .select("id")
          .eq("provider_email_id", emailId)
          .eq("storage_path", storagePath)
          .maybeSingle();

      if (existingError) {
        throw new Error(
          `Unable to check existing report: ${existingError.message}`,
        );
      }

      let reportId: string;

      if (existingReport?.id) {
        const { error: updateError } = await supabase
          .from("ainapo_permit_reports")
          .update(reportValues)
          .eq("id", existingReport.id);

        if (updateError) {
          throw new Error(
            `Unable to update report: ${updateError.message}`,
          );
        }

        reportId = existingReport.id;
      } else {
        const { data: insertedReport, error: insertError } =
          await supabase
            .from("ainapo_permit_reports")
            .insert(reportValues)
            .select("id")
            .single();

        if (insertError) {
          throw new Error(
            `Unable to create report: ${insertError.message}`,
          );
        }

        reportId = insertedReport.id;
      }

      const processingResult = await processAinapoPdf({
        supabase,
        reportId,
        pdfBytes,
      });

      storedReports.push({
        report_id: reportId,
        filename: attachment.filename,
        storage_path: storagePath,
        bytes: pdfBytes.byteLength,
        ...processingResult,
      });
    }

    console.log("Stored Ainapo permit report:", {
      emailId,
      storedReports,
    });

    return jsonResponse({
      success: true,
      email_id: emailId,
      report_date_hst: reportDate,
      stored_reports: storedReports,
      status: "processing complete",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error("Ainapo permit report processing failed:", message);

    return jsonResponse(
      {
        error: "Unable to store Ainapo permit report",
        details: message,
        email_id: emailId,
      },
      500,
    );
  }
});
