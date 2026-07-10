"use client";

import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import StatusBadge from "../../ui/StatusBadge";
import { getSupabaseClient } from "../../../lib/supabaseClient";

type AccountDocument = {
  id: string;
  document_type: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  expires_at: string | null;

  // These may or may not already be returned by your documents API.
  // The ID parser needs one of these storage path fields.
  document_path?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  path?: string | null;
};

type UploadResult = {
  success?: boolean;
  error?: string;
  document?: AccountDocument | null;
  documents?: AccountDocument[];
  documentPath?: string | null;
  document_path?: string | null;
  storagePath?: string | null;
  storage_path?: string | null;
  filePath?: string | null;
  file_path?: string | null;
  path?: string | null;
};

function getDocumentTone(expiresAt: string | null): "green" | "yellow" | "red" {
  if (!expiresAt) return "yellow";

  const today = new Date();
  const expiration = new Date(expiresAt);
  const daysUntilExpiration = Math.ceil(
    (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiration < 0) return "red";
  if (daysUntilExpiration <= 60) return "yellow";
  return "green";
}

function getDocumentStatus(expiresAt: string | null) {
  if (!expiresAt) return "Expiration Needed";

  const today = new Date();
  const expiration = new Date(expiresAt);
  const daysUntilExpiration = Math.ceil(
    (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiration < 0) return "Expired";
  if (daysUntilExpiration <= 60) return "Expiring Soon";
  return "Valid";
}

function getDocumentPathFromDocument(document?: AccountDocument | null) {
  if (!document) return "";

  return (
    document.document_path ||
    document.storage_path ||
    document.file_path ||
    document.path ||
    ""
  );
}

function getDocumentPathFromUploadResult(result: UploadResult) {
  return (
    result.documentPath ||
    result.document_path ||
    result.storagePath ||
    result.storage_path ||
    result.filePath ||
    result.file_path ||
    result.path ||
    getDocumentPathFromDocument(result.document) ||
    getDocumentPathFromDocument(result.documents?.[0]) ||
    ""
  );
}

export default function DocumentManager({
  accountId,
  refreshTimeline,
}: {
  accountId: string;
  refreshTimeline: () => Promise<void>;
}) {
  const [documents, setDocuments] = useState<AccountDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingReview, setProcessingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewMessageTone, setReviewMessageTone] = useState<
    "neutral" | "success" | "warning" | "error"
  >("neutral");

  const latestDocument = documents[0];

  async function loadDocuments() {
    setLoading(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/documents`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load documents.");
      }

      const loadedDocuments = result.documents ?? [];

      setDocuments(loadedDocuments);
      setExpiresAt(loadedDocuments?.[0]?.expires_at || "");

      return loadedDocuments as AccountDocument[];
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load documents.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function viewDocument(documentId: string) {
    try {
      const response = await fetch(`/api/documents/${documentId}/signed-url`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to open document.");
        return;
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to open document.");
    }
  }

  async function processIdDocument(documentPath: string) {
    if (!documentPath) {
      setReviewMessageTone("warning");
      setReviewMessage(
        "ID uploaded, but automatic ID review could not start because the upload API did not return the storage path."
      );
      return;
    }

    setProcessingReview(true);
    setReviewMessageTone("neutral");
    setReviewMessage("ID uploaded. Running automatic ID review...");

    try {
      const supabase = getSupabaseClient() as any;

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Unable to verify the current admin session.");
      }

      const response = await fetch("/api/admin/id-documents/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          accessAccountId: accountId,
          documentPath,
          bucket: "kapapala-documents",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "ID was uploaded, but automatic review failed."
        );
      }

      if (result.flags && result.flags.length > 0) {
        setReviewMessageTone("warning");
        setReviewMessage(
          `Automatic ID review completed with warning flag(s): ${result.flags.join(
            ", "
          )}.`
        );
      } else {
        setReviewMessageTone("success");
        setReviewMessage("Automatic ID review completed. No warnings found.");
      }

      await refreshTimeline();

      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error) {
      setReviewMessageTone("error");
      setReviewMessage(
        error instanceof Error
          ? error.message
          : "ID was uploaded, but automatic review failed."
      );
    } finally {
      setProcessingReview(false);
    }
  }

  async function uploadDocument() {
    if (!file) {
      alert("Choose a file first.");
      return;
    }

    setUploading(true);
    setReviewMessage("");
    setReviewMessageTone("neutral");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("expiresAt", expiresAt);

      const response = await fetch(`/api/access-accounts/${accountId}/documents`, {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as UploadResult;

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to upload document.");
        return;
      }

      const uploadedDocumentPath = getDocumentPathFromUploadResult(result);

      setFile(null);

      const loadedDocuments = await loadDocuments();
      await refreshTimeline();

      const fallbackDocumentPath = getDocumentPathFromDocument(loadedDocuments[0]);
      const documentPath = uploadedDocumentPath || fallbackDocumentPath;

      await processIdDocument(documentPath);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to upload and review document."
      );
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, [accountId]);

  const uploadButtonLabel = uploading
    ? "Uploading..."
    : processingReview
      ? "Reviewing ID..."
      : "Upload / Replace ID";

  const reviewMessageStyle =
    reviewMessageTone === "success"
      ? {
          background: "#dcfce7",
          border: "1px solid #86efac",
          color: "#166534",
        }
      : reviewMessageTone === "warning"
        ? {
            background: "#ffedd5",
            border: "1px solid #fb923c",
            color: "#7c2d12",
          }
        : reviewMessageTone === "error"
          ? {
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
            }
          : {
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              color: "#334155",
            };

  return (
    <Card title="ID / Driver License">
      {loading && <p className="muted-text">Loading documents...</p>}

      {!loading && !latestDocument && (
        <p className="muted-text">No ID document uploaded.</p>
      )}

      {!loading && latestDocument && (
        <div className="profile-detail-list">
          <div>
            <span>Status</span>
            <strong>
              <StatusBadge
                label={getDocumentStatus(latestDocument.expires_at)}
                tone={getDocumentTone(latestDocument.expires_at)}
              />
            </strong>
          </div>

          <div>
            <span>Document</span>
            <strong>{latestDocument.original_filename || "Driver License"}</strong>
          </div>

          <div>
            <span>Uploaded</span>
            <strong>{new Date(latestDocument.uploaded_at).toLocaleString()}</strong>
          </div>

          <div>
            <span>Expires</span>
            <strong>{latestDocument.expires_at || "Not entered"}</strong>
          </div>

          <button
            className="button secondary"
            type="button"
            onClick={() => viewDocument(latestDocument.id)}
          >
            View ID
          </button>
        </div>
      )}

      {reviewMessage && (
        <div
          style={{
            ...reviewMessageStyle,
            borderRadius: 12,
            padding: "10px 12px",
            marginTop: 16,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {reviewMessage}
        </div>
      )}

      <div className="mobile-form-stack" style={{ marginTop: 16 }}>
        <label>
          Expiration Date
          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </label>

        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          disabled={uploading || processingReview}
        />

        <button
          className="button primary"
          type="button"
          onClick={uploadDocument}
          disabled={uploading || processingReview}
        >
          {uploadButtonLabel}
        </button>
      </div>
    </Card>
  );
}