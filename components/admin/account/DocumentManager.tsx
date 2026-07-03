"use client";

import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import StatusBadge from "../../ui/StatusBadge";

type AccountDocument = {
  id: string;
  document_type: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  expires_at: string | null;
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

  const latestDocument = documents[0];

  async function loadDocuments() {
  setLoading(true);

  try {
    const response = await fetch(`/api/access-accounts/${accountId}/documents`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Unable to load documents.");
    }

    setDocuments(result.documents ?? []);
    setExpiresAt(result.documents?.[0]?.expires_at || "");
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to load documents.");
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

  async function uploadDocument() {
    if (!file) {
      alert("Choose a file first.");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("expiresAt", expiresAt);

    const response = await fetch(`/api/access-accounts/${accountId}/documents`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert(result.error || "Unable to upload document.");
      setUploading(false);
      return;
    }

    setFile(null);
    await loadDocuments();
    await refreshTimeline();
    setUploading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, [accountId]);

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
        />

        <button
          className="button primary"
          type="button"
          onClick={uploadDocument}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload / Replace ID"}
        </button>
      </div>
    </Card>
  );
}