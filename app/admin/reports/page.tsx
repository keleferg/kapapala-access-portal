"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";
import { getSupabaseClient } from "../../../lib/supabaseClient";

type ReportType =
  | "users"
  | "accessRequests"
  | "accessEntries"
  | "userSummary"
  | "systemLog";

type GateOption = {
  id: string;
  name: string;
};

type UsersReportRow = {
  access_account_id: string;
  profile_id: string | null;
  access_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  account_status: string | null;
  account_type: string | null;
  organization: string | null;
  default_gate: string | null;
  app_role: string | null;
  issued_at: string | null;
  expires_at: string | null;
  id_expires_at: string | null;
  source_system: string | null;
  sharepoint_item_id: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type AccessRequestReportRow = {
  request_id: string;
  request_number: string | null;
  request_date: string;
  gate_id: string;
  gate_name: string | null;
  access_account_id: string;
  access_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  organization: string | null;
  status: string | null;
  pending_reason: string | null;
  status_reason: string | null;
  approved_at: string | null;
  exited_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AccessEntryReportRow = {
  reveal_id: string;
  revealed_at: string;
  request_id: string;
  request_number: string | null;
  request_date: string;
  gate_id: string;
  gate_name: string | null;
  access_account_id: string;
  access_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  purpose: string | null;
  party_size: number | null;
  vehicle_summary: string | null;
  request_status: string | null;
  exited_at: string | null;
};

type UserSummaryReportRow = {
  access_account_id: string;
  access_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  account_status: string | null;
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  denied_requests: number;
  cancelled_requests: number;
  completed_requests: number;
  exited_requests: number;
  gate_code_reveals: number;
  wood_valley_requests: number;
  honanui_requests: number;
  ainapo_requests: number;
  first_request_date: string | null;
  last_request_date: string | null;
};

type SystemLogReportRow = {
  id: string;
  occurred_at: string;
  actor_profile_id: string | null;
  actor_access_account_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  request_id: string | null;
  access_account_id: string | null;
  gate_id: string | null;
  severity: string;
  summary: string;
  details: Record<string, unknown> | null;
  source: string;
  ip_address: string | null;
  user_agent: string | null;
};

type PdfColumnStyle = {
  cellWidth: number;
};

function todayMinus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const dateOnly = value.slice(0, 10);
  const parts = dateOnly.split("-");

  if (parts.length !== 3) return value;

  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPdfDateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fullName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || "—";
}

function displayGateName(value: string | null) {
  if (!value) return "—";

  const normalized = value
    .replaceAll("ʻ", "")
    .replaceAll("‘", "")
    .replaceAll("’", "")
    .replaceAll("`", "")
    .replaceAll("Ā", "A")
    .replaceAll("ā", "a")
    .replaceAll("Ē", "E")
    .replaceAll("ē", "e")
    .replaceAll("Ī", "I")
    .replaceAll("ī", "i")
    .replaceAll("Ō", "O")
    .replaceAll("ō", "o")
    .replaceAll("Ū", "U")
    .replaceAll("ū", "u")
    .trim();

  if (normalized.toLowerCase().includes("ainapo")) {
    return "Ainapo";
  }

  return normalized;
}

function csvEscape(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function detailsText(details: Record<string, unknown> | null) {
  if (!details) return "—";

  try {
    return JSON.stringify(details);
  } catch {
    return "—";
  }
}

function severityClass(severity: string | null) {
  const value = (severity || "").toLowerCase();

  if (value === "warning") return "status-badge warning";
  if (value === "error") return "status-badge denied";
  if (value === "critical") return "status-badge denied";

  return "status-badge approved";
}

function reportTitle(report: ReportType) {
  switch (report) {
    case "users":
      return "Users Report";
    case "accessRequests":
      return "Access Requests Report";
    case "accessEntries":
      return "Access Entry Report";
    case "userSummary":
      return "User Access Summary Report";
    case "systemLog":
      return "System Activity Log";
    default:
      return "Report";
  }
}

function reportFileName(report: ReportType, startDate: string, endDate: string) {
  const base = reportTitle(report)
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("/", "-");

  if (report === "users") {
    return `kapapala-${base}.pdf`;
  }

  return `kapapala-${base}-${startDate}-to-${endDate}.pdf`;
}

function normalizePdfValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }

  return String(value);
}

function drawKapapalaPdfTitle(doc: jsPDF, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);

  const part1 = "Kap";
  const macronA = "a";
  const part2 = "pala Access Portal";

  doc.text(part1, x, y);

  const xA = x + doc.getTextWidth(part1);
  doc.text(macronA, xA, y);

  const aWidth = doc.getTextWidth(macronA);

  doc.setLineWidth(0.35);
  doc.line(xA + 0.2, y - 4.5, xA + aWidth - 0.2, y - 4.5);

  doc.text(part2, xA + aWidth, y);

  doc.setFont("helvetica", "normal");
}

function addPdfHeader(
  doc: jsPDF,
  title: string,
  startDate: string,
  endDate: string,
  activeReport: ReportType,
  recordCount: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  drawKapapalaPdfTitle(doc, 10, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(title, 10, 24);

  doc.setFontSize(9);

  const rangeText =
    activeReport === "users"
      ? "All available records"
      : `Date Range: ${startDate} to ${endDate}`;

  doc.text(rangeText, 10, 31);
  doc.text(`Records: ${recordCount}`, 10, 36);

  const generatedText = `Generated: ${new Date().toLocaleString("en-US")}`;
  doc.text(generatedText, pageWidth - 10, 16, { align: "right" });

  doc.setLineWidth(0.2);
  doc.line(10, 40, pageWidth - 10, 40);
}

function getPdfColumnStyles(report: ReportType): Record<number, PdfColumnStyle> {
  if (report === "users") {
    return {
      0: { cellWidth: 20 },
      1: { cellWidth: 34 },
      2: { cellWidth: 52 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22 },
      5: { cellWidth: 34 },
      6: { cellWidth: 44 },
      7: { cellWidth: 30 },
      8: { cellWidth: 26 },
      9: { cellWidth: 24 },
    };
  }

  if (report === "accessRequests") {
    return {
      0: { cellWidth: 30 },
      1: { cellWidth: 22 },
      2: { cellWidth: 30 },
      3: { cellWidth: 18 },
      4: { cellWidth: 34 },
      5: { cellWidth: 54 },
      6: { cellWidth: 46 },
      7: { cellWidth: 10 },
      8: { cellWidth: 48 },
      9: { cellWidth: 22 },
      10: { cellWidth: 28 },
    };
  }

  if (report === "accessEntries") {
    return {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 22 },
      3: { cellWidth: 30 },
      4: { cellWidth: 18 },
      5: { cellWidth: 34 },
      6: { cellWidth: 54 },
      7: { cellWidth: 42 },
      8: { cellWidth: 10 },
      9: { cellWidth: 44 },
      10: { cellWidth: 22 },
      11: { cellWidth: 28 },
    };
  }

  if (report === "userSummary") {
    return {
      0: { cellWidth: 20 },
      1: { cellWidth: 34 },
      2: { cellWidth: 52 },
      3: { cellWidth: 22 },
      4: { cellWidth: 13 },
      5: { cellWidth: 16 },
      6: { cellWidth: 16 },
      7: { cellWidth: 16 },
      8: { cellWidth: 18 },
      9: { cellWidth: 18 },
      10: { cellWidth: 15 },
      11: { cellWidth: 16 },
      12: { cellWidth: 22 },
      13: { cellWidth: 22 },
      14: { cellWidth: 22 },
      15: { cellWidth: 24 },
    };
  }

  return {
    0: { cellWidth: 32 },
    1: { cellWidth: 42 },
    2: { cellWidth: 18 },
    3: { cellWidth: 92 },
    4: { cellWidth: 46 },
    5: { cellWidth: 28 },
    6: { cellWidth: 30 },
    7: { cellWidth: 52 },
  };
}

export default function ReportsPage() {
  const supabase = getSupabaseClient();

  const [activeReport, setActiveReport] = useState<ReportType>("users");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [gates, setGates] = useState<GateOption[]>([]);
  const [startDate, setStartDate] = useState(todayMinus(30));
  const [endDate, setEndDate] = useState(today());
  const [gateId, setGateId] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [usersRows, setUsersRows] = useState<UsersReportRow[]>([]);
  const [requestRows, setRequestRows] = useState<AccessRequestReportRow[]>([]);
  const [entryRows, setEntryRows] = useState<AccessEntryReportRow[]>([]);
  const [summaryRows, setSummaryRows] = useState<UserSummaryReportRow[]>([]);
  const [systemLogRows, setSystemLogRows] = useState<SystemLogReportRow[]>([]);

  useEffect(() => {
    loadGates();
    loadActiveReport("users");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadActiveReport(activeReport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, startDate, endDate, gateId, severity]);

  async function loadGates() {
    const { data, error } = await supabase
      .from("gates")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Gate load failed:", error);
      return;
    }

    setGates((data || []) as GateOption[]);
  }

  async function loadActiveReport(report: ReportType) {
    setLoading(true);
    setErrorMessage(null);

    const selectedGateId = gateId === "all" ? null : gateId;
    const selectedSeverity = severity === "all" ? null : severity;

    if (report === "users") {
      const { data, error } = await (supabase as any).rpc("get_admin_users_report");

      if (error) {
        setErrorMessage(error.message);
        setUsersRows([]);
      } else {
        setUsersRows((data || []) as UsersReportRow[]);
      }

      setLoading(false);
      return;
    }

    if (report === "accessRequests") {
      const { data, error } = await (supabase as any).rpc(
        "get_admin_access_requests_report",
        {
          p_start_date: startDate,
          p_end_date: endDate,
          p_gate_id: selectedGateId,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        setRequestRows([]);
      } else {
        setRequestRows((data || []) as AccessRequestReportRow[]);
      }

      setLoading(false);
      return;
    }

    if (report === "accessEntries") {
      const { data, error } = await (supabase as any).rpc(
        "get_admin_access_entry_report",
        {
          p_start_date: startDate,
          p_end_date: endDate,
          p_gate_id: selectedGateId,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        setEntryRows([]);
      } else {
        setEntryRows((data || []) as AccessEntryReportRow[]);
      }

      setLoading(false);
      return;
    }

    if (report === "userSummary") {
      const { data, error } = await (supabase as any).rpc(
        "get_admin_user_access_summary_report",
        {
          p_start_date: startDate,
          p_end_date: endDate,
          p_gate_id: selectedGateId,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        setSummaryRows([]);
      } else {
        setSummaryRows((data || []) as UserSummaryReportRow[]);
      }

      setLoading(false);
      return;
    }

    if (report === "systemLog") {
      const { data, error } = await (supabase as any).rpc(
        "get_admin_system_activity_log",
        {
          p_start_date: startDate,
          p_end_date: endDate,
          p_action: null,
          p_severity: selectedSeverity,
          p_search: null,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        setSystemLogRows([]);
      } else {
        setSystemLogRows((data || []) as SystemLogReportRow[]);
      }

      setLoading(false);
    }
  }

  function searchableText(values: unknown[]) {
    return values
      .filter((value) => value !== null && value !== undefined)
      .map((value) =>
        typeof value === "object" ? JSON.stringify(value) : String(value)
      )
      .join(" ")
      .toLowerCase();
  }

  const filteredUsers = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    if (!search) return usersRows;

    return usersRows.filter((row) =>
      searchableText([
        row.access_id,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.account_status,
        row.account_type,
        row.organization,
        row.default_gate,
        row.app_role,
      ]).includes(search)
    );
  }, [usersRows, searchText]);

  const filteredRequests = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    if (!search) return requestRows;

    return requestRows.filter((row) =>
      searchableText([
        row.request_number,
        row.request_date,
        row.gate_name,
        row.access_id,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.purpose,
        row.vehicle_summary,
        row.organization,
        row.status,
        row.status_reason,
      ]).includes(search)
    );
  }, [requestRows, searchText]);

  const filteredEntries = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    if (!search) return entryRows;

    return entryRows.filter((row) =>
      searchableText([
        row.revealed_at,
        row.request_number,
        row.request_date,
        row.gate_name,
        row.access_id,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.purpose,
        row.vehicle_summary,
        row.request_status,
      ]).includes(search)
    );
  }, [entryRows, searchText]);

  const filteredSummary = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    if (!search) return summaryRows;

    return summaryRows.filter((row) =>
      searchableText([
        row.access_id,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.account_status,
        row.first_request_date,
        row.last_request_date,
      ]).includes(search)
    );
  }, [summaryRows, searchText]);

  const filteredSystemLog = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    if (!search) return systemLogRows;

    return systemLogRows.filter((row) =>
      searchableText([
        row.occurred_at,
        row.actor_email,
        row.actor_role,
        row.action,
        row.entity_type,
        row.severity,
        row.summary,
        row.source,
        row.details,
        row.ip_address,
        row.user_agent,
      ]).includes(search)
    );
  }, [systemLogRows, searchText]);

  const currentCount =
    activeReport === "users"
      ? filteredUsers.length
      : activeReport === "accessRequests"
      ? filteredRequests.length
      : activeReport === "accessEntries"
      ? filteredEntries.length
      : activeReport === "userSummary"
      ? filteredSummary.length
      : filteredSystemLog.length;

  function openReport(report: ReportType) {
    setSearchText("");
    setActiveReport(report);
  }

  function exportCurrentReportPdf() {
    const title = reportTitle(activeReport);

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "legal",
    });

    let headers: string[] = [];
    let body: unknown[][] = [];

    if (activeReport === "users") {
      headers = [
        "Access ID",
        "Name",
        "Email",
        "Phone",
        "Status",
        "Type",
        "Organization",
        "Default Gate",
        "Role",
        "Expires",
      ];

      body = filteredUsers.map((row) => [
        row.access_id,
        fullName(row.first_name, row.last_name),
        row.email,
        row.phone,
        row.account_status,
        row.account_type,
        row.organization,
        displayGateName(row.default_gate),
        row.app_role,
        formatDate(row.expires_at),
      ]);
    }

    if (activeReport === "accessRequests") {
      headers = [
        "Request #",
        "Date",
        "Gate",
        "Access ID",
        "Name",
        "Email",
        "Purpose",
        "Party",
        "Vehicle",
        "Status",
        "Created",
      ];

      body = filteredRequests.map((row) => [
        row.request_number,
        formatDate(row.request_date),
        displayGateName(row.gate_name),
        row.access_id,
        fullName(row.first_name, row.last_name),
        row.email,
        row.purpose,
        row.party_size,
        row.vehicle_summary,
        row.status,
        formatPdfDateTime(row.created_at),
      ]);
    }

    if (activeReport === "accessEntries") {
      headers = [
        "Revealed At",
        "Request #",
        "Request Date",
        "Gate",
        "Access ID",
        "Name",
        "Email",
        "Purpose",
        "Party",
        "Vehicle",
        "Status",
        "Exited",
      ];

      body = filteredEntries.map((row) => [
        formatPdfDateTime(row.revealed_at),
        row.request_number,
        formatDate(row.request_date),
        displayGateName(row.gate_name),
        row.access_id,
        fullName(row.first_name, row.last_name),
        row.email,
        row.purpose,
        row.party_size,
        row.vehicle_summary,
        row.request_status,
        formatPdfDateTime(row.exited_at),
      ]);
    }

    if (activeReport === "userSummary") {
      headers = [
        "Access ID",
        "Name",
        "Email",
        "Status",
        "Total",
        "Approved",
        "Pending",
        "Denied",
        "Cancelled",
        "Completed",
        "Exited",
        "Reveals",
        "Wood Valley",
        "Honanui",
        "Ainapo",
        "Last Request",
      ];

      body = filteredSummary.map((row) => [
        row.access_id,
        fullName(row.first_name, row.last_name),
        row.email,
        row.account_status,
        row.total_requests,
        row.approved_requests,
        row.pending_requests,
        row.denied_requests,
        row.cancelled_requests,
        row.completed_requests,
        row.exited_requests,
        row.gate_code_reveals,
        row.wood_valley_requests,
        row.honanui_requests,
        row.ainapo_requests,
        formatDate(row.last_request_date),
      ]);
    }

    if (activeReport === "systemLog") {
      headers = [
        "Occurred At",
        "Action",
        "Severity",
        "Summary",
        "Actor",
        "Source",
        "Entity",
        "Details",
      ];

      body = filteredSystemLog.map((row) => [
        formatPdfDateTime(row.occurred_at),
        row.action,
        row.severity,
        row.summary,
        row.actor_email,
        row.source,
        row.entity_type,
        detailsText(row.details),
      ]);
    }

    addPdfHeader(doc, title, startDate, endDate, activeReport, body.length);

    const nowrapColumnsByReport: Record<ReportType, number[]> = {
      users: [0, 3, 4, 7, 8, 9],
      accessRequests: [0, 1, 2, 3, 7, 9, 10],
      accessEntries: [0, 1, 2, 3, 4, 8, 10, 11],
      userSummary: [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15],
      systemLog: [0, 1, 2, 5, 6],
    };

    const wrapColumnsByReport: Record<ReportType, number[]> = {
      users: [1, 2, 5, 6],
      accessRequests: [4, 5, 6, 8],
      accessEntries: [5, 6, 7, 9],
      userSummary: [1, 2],
      systemLog: [3, 4, 7],
    };

    autoTable(doc, {
      head: [headers],
      body: body.map((row) => row.map(normalizePdfValue)),
      startY: 44,
      theme: "striped",
      tableWidth: "wrap",
      styles: {
        fontSize: activeReport === "systemLog" ? 5.8 : 6.6,
        cellPadding: 1.3,
        overflow: "linebreak",
        valign: "middle",
        minCellHeight: 5,
      },
      headStyles: {
        fontSize: activeReport === "systemLog" ? 5.8 : 6.6,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },
      bodyStyles: {
        valign: "middle",
      },
      columnStyles: getPdfColumnStyles(activeReport),
      margin: {
        top: 44,
        right: 8,
        bottom: 12,
        left: 8,
      },
      didParseCell: (data) => {
        const columnIndex = data.column.index;

        if (nowrapColumnsByReport[activeReport].includes(columnIndex)) {
          data.cell.styles.overflow = "ellipsize";
        }

        if (wrapColumnsByReport[activeReport].includes(columnIndex)) {
          data.cell.styles.overflow = "linebreak";
        }
      },
      didDrawPage: () => {
        const pageNumber = doc.getCurrentPageInfo().pageNumber;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFontSize(8);
        doc.text(`Page ${pageNumber}`, pageWidth - 14, pageHeight - 7, {
          align: "right",
        });
      },
    });

    doc.save(reportFileName(activeReport, startDate, endDate));
  }

  function exportCurrentReport() {
    if (activeReport === "users") {
      downloadCsv(
        "kapapala-users-report.csv",
        [
          "Access ID",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Status",
          "Account Type",
          "Organization",
          "Default Gate",
          "App Role",
          "Issued At",
          "Expires At",
          "ID Expires At",
          "Source System",
          "SharePoint Item ID",
          "Created At",
          "Updated At",
        ],
        filteredUsers.map((row) => [
          row.access_id,
          row.first_name,
          row.last_name,
          row.email,
          row.phone,
          row.account_status,
          row.account_type,
          row.organization,
          displayGateName(row.default_gate),
          row.app_role,
          row.issued_at,
          row.expires_at,
          row.id_expires_at,
          row.source_system,
          row.sharepoint_item_id,
          row.created_at,
          row.updated_at,
        ])
      );
      return;
    }

    if (activeReport === "accessRequests") {
      downloadCsv(
        `kapapala-access-requests-${startDate}-to-${endDate}.csv`,
        [
          "Request Number",
          "Request Date",
          "Gate",
          "Access ID",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Purpose",
          "Party Size",
          "Vehicle Summary",
          "Organization",
          "Status",
          "Pending Reason",
          "Status Reason",
          "Approved At",
          "Exited At",
          "Created At",
          "Updated At",
        ],
        filteredRequests.map((row) => [
          row.request_number,
          row.request_date,
          displayGateName(row.gate_name),
          row.access_id,
          row.first_name,
          row.last_name,
          row.email,
          row.phone,
          row.purpose,
          row.party_size,
          row.vehicle_summary,
          row.organization,
          row.status,
          row.pending_reason,
          row.status_reason,
          row.approved_at,
          row.exited_at,
          row.created_at,
          row.updated_at,
        ])
      );
      return;
    }

    if (activeReport === "accessEntries") {
      downloadCsv(
        `kapapala-access-entry-${startDate}-to-${endDate}.csv`,
        [
          "Revealed At",
          "Request Number",
          "Request Date",
          "Gate",
          "Access ID",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Purpose",
          "Party Size",
          "Vehicle Summary",
          "Request Status",
          "Exited At",
        ],
        filteredEntries.map((row) => [
          row.revealed_at,
          row.request_number,
          row.request_date,
          displayGateName(row.gate_name),
          row.access_id,
          row.first_name,
          row.last_name,
          row.email,
          row.phone,
          row.purpose,
          row.party_size,
          row.vehicle_summary,
          row.request_status,
          row.exited_at,
        ])
      );
      return;
    }

    if (activeReport === "userSummary") {
      downloadCsv(
        `kapapala-user-access-summary-${startDate}-to-${endDate}.csv`,
        [
          "Access ID",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Account Status",
          "Total Requests",
          "Pending",
          "Approved",
          "Denied",
          "Cancelled",
          "Completed",
          "Exited",
          "Gate Code Reveals",
          "Wood Valley",
          "Honanui",
          "Ainapo",
          "First Request Date",
          "Last Request Date",
        ],
        filteredSummary.map((row) => [
          row.access_id,
          row.first_name,
          row.last_name,
          row.email,
          row.phone,
          row.account_status,
          row.total_requests,
          row.pending_requests,
          row.approved_requests,
          row.denied_requests,
          row.cancelled_requests,
          row.completed_requests,
          row.exited_requests,
          row.gate_code_reveals,
          row.wood_valley_requests,
          row.honanui_requests,
          row.ainapo_requests,
          row.first_request_date,
          row.last_request_date,
        ])
      );
      return;
    }

    downloadCsv(
      `kapapala-system-activity-log-${startDate}-to-${endDate}.csv`,
      [
        "Occurred At",
        "Action",
        "Severity",
        "Summary",
        "Actor Email",
        "Actor Role",
        "Source",
        "Entity Type",
        "Entity ID",
        "Request ID",
        "Access Account ID",
        "Gate ID",
        "IP Address",
        "User Agent",
        "Details",
      ],
      filteredSystemLog.map((row) => [
        row.occurred_at,
        row.action,
        row.severity,
        row.summary,
        row.actor_email,
        row.actor_role,
        row.source,
        row.entity_type,
        row.entity_id,
        row.request_id,
        row.access_account_id,
        row.gate_id,
        row.ip_address,
        row.user_agent,
        row.details,
      ])
    );
  }

  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Reports</h2>
        <span>
          View user, access request, gate entry, user summary, and system
          activity reports.
        </span>
      </div>

      <Card title="Available Reports">
        <div style={{ display: "grid", gap: "0.85rem" }}>
          <button
            type="button"
            className={
              activeReport === "users"
                ? "button form-button"
                : "button secondary form-button"
            }
            onClick={() => openReport("users")}
            style={{
              width: "100%",
              textAlign: "left",
              justifyContent: "space-between",
              padding: "1rem",
            }}
          >
            <span>
              <strong>Users Report</strong>
              <br />
              <span className="muted-text">
                All users and access account information.
              </span>
            </span>
            <span>Open Report</span>
          </button>

          <button
            type="button"
            className={
              activeReport === "accessRequests"
                ? "button form-button"
                : "button secondary form-button"
            }
            onClick={() => openReport("accessRequests")}
            style={{
              width: "100%",
              textAlign: "left",
              justifyContent: "space-between",
              padding: "1rem",
            }}
          >
            <span>
              <strong>Access Requests Report</strong>
              <br />
              <span className="muted-text">
                Requests by date range, gate, status, and user.
              </span>
            </span>
            <span>Open Report</span>
          </button>

          <button
            type="button"
            className={
              activeReport === "accessEntries"
                ? "button form-button"
                : "button secondary form-button"
            }
            onClick={() => openReport("accessEntries")}
            style={{
              width: "100%",
              textAlign: "left",
              justifyContent: "space-between",
              padding: "1rem",
            }}
          >
            <span>
              <strong>Access Entry Report</strong>
              <br />
              <span className="muted-text">
                Actual gate code reveals by user, request, and gate.
              </span>
            </span>
            <span>Open Report</span>
          </button>

          <button
            type="button"
            className={
              activeReport === "userSummary"
                ? "button form-button"
                : "button secondary form-button"
            }
            onClick={() => openReport("userSummary")}
            style={{
              width: "100%",
              textAlign: "left",
              justifyContent: "space-between",
              padding: "1rem",
            }}
          >
            <span>
              <strong>User Access Summary Report</strong>
              <br />
              <span className="muted-text">
                Request totals and gate usage grouped by user.
              </span>
            </span>
            <span>Open Report</span>
          </button>

          <button
            type="button"
            className={
              activeReport === "systemLog"
                ? "button form-button"
                : "button secondary form-button"
            }
            onClick={() => openReport("systemLog")}
            style={{
              width: "100%",
              textAlign: "left",
              justifyContent: "space-between",
              padding: "1rem",
            }}
          >
            <span>
              <strong>System Activity Log</strong>
              <br />
              <span className="muted-text">
                Full audit trail of admin actions, user actions, gate changes,
                request changes, and system events.
              </span>
            </span>
            <span>Open Report</span>
          </button>
        </div>
      </Card>

      <Card title="Report Filters">
        <div className="form-grid four">
          {activeReport !== "users" && (
            <>
              <label className="form-field">
                <span>Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            </>
          )}

          {activeReport !== "users" && activeReport !== "systemLog" && (
            <label className="form-field">
              <span>Gate</span>
              <select
                value={gateId}
                onChange={(event) => setGateId(event.target.value)}
              >
                <option value="all">All Gates</option>
                {gates.map((gate) => (
                  <option key={gate.id} value={gate.id}>
                    {displayGateName(gate.name)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {activeReport === "systemLog" && (
            <label className="form-field">
              <span>Severity</span>
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          )}

          <label className="form-field">
            <span>Search</span>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search report..."
            />
          </label>
        </div>

        <div className="form-actions" style={{ marginTop: "1rem" }}>
          <button
            className="button secondary form-button"
            type="button"
            onClick={() => loadActiveReport(activeReport)}
          >
            Refresh
          </button>

          <button
            className="button form-button"
            type="button"
            onClick={exportCurrentReport}
            disabled={currentCount === 0}
          >
            Export CSV
          </button>

          <button
            className="button secondary form-button"
            type="button"
            onClick={exportCurrentReportPdf}
            disabled={currentCount === 0}
          >
            Export PDF
          </button>

          <span className="muted-text">
            {loading ? "Loading..." : `${currentCount} record(s)`}
          </span>
        </div>
      </Card>

      {errorMessage && (
        <Card title="Report Error">
          <p className="error-text">{errorMessage}</p>
        </Card>
      )}

      {activeReport === "users" && (
        <Card title="Users Report">
          {loading ? (
            <p className="muted-text">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="muted-text">No users match the current search.</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Access ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Organization</th>
                    <th>Default Gate</th>
                    <th>Role</th>
                    <th>Expires</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((row) => (
                    <tr key={row.access_account_id}>
                      <td>{row.access_id || "—"}</td>
                      <td>{fullName(row.first_name, row.last_name)}</td>
                      <td>{row.email || "—"}</td>
                      <td>{row.phone || "—"}</td>
                      <td>
                        <StatusBadge label={row.account_status || "active"} />
                      </td>
                      <td>{row.account_type || "—"}</td>
                      <td>{row.organization || "—"}</td>
                      <td>{displayGateName(row.default_gate)}</td>
                      <td>{row.app_role || "—"}</td>
                      <td>{formatDate(row.expires_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeReport === "accessRequests" && (
        <Card title="Access Requests Report">
          {loading ? (
            <p className="muted-text">Loading access requests...</p>
          ) : filteredRequests.length === 0 ? (
            <p className="muted-text">
              No access requests match the current filters.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Request #</th>
                    <th>Date</th>
                    <th>Gate</th>
                    <th>Access ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Purpose</th>
                    <th>Party</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((row) => (
                    <tr key={row.request_id}>
                      <td>{row.request_number || "—"}</td>
                      <td>{formatDate(row.request_date)}</td>
                      <td>{displayGateName(row.gate_name)}</td>
                      <td>{row.access_id || "—"}</td>
                      <td>{fullName(row.first_name, row.last_name)}</td>
                      <td>{row.email || "—"}</td>
                      <td>{row.purpose || "—"}</td>
                      <td>{row.party_size ?? "—"}</td>
                      <td>{row.vehicle_summary || "—"}</td>
                      <td>
                        <StatusBadge label={row.status || "pending"} />
                      </td>
                      <td>{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeReport === "accessEntries" && (
        <Card title="Access Entry Report">
          {loading ? (
            <p className="muted-text">Loading access entries...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="muted-text">
              No gate code reveals match the current filters.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Revealed At</th>
                    <th>Request #</th>
                    <th>Request Date</th>
                    <th>Gate</th>
                    <th>Access ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Purpose</th>
                    <th>Party</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Exited</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEntries.map((row) => (
                    <tr key={row.reveal_id}>
                      <td>{formatDateTime(row.revealed_at)}</td>
                      <td>{row.request_number || "—"}</td>
                      <td>{formatDate(row.request_date)}</td>
                      <td>{displayGateName(row.gate_name)}</td>
                      <td>{row.access_id || "—"}</td>
                      <td>{fullName(row.first_name, row.last_name)}</td>
                      <td>{row.email || "—"}</td>
                      <td>{row.purpose || "—"}</td>
                      <td>{row.party_size ?? "—"}</td>
                      <td>{row.vehicle_summary || "—"}</td>
                      <td>
                        <StatusBadge label={row.request_status || "approved"} />
                      </td>
                      <td>{formatDateTime(row.exited_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeReport === "userSummary" && (
        <Card title="User Access Summary Report">
          {loading ? (
            <p className="muted-text">Loading user access summary...</p>
          ) : filteredSummary.length === 0 ? (
            <p className="muted-text">
              No user access summary records match the current filters.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Access ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Approved</th>
                    <th>Pending</th>
                    <th>Denied</th>
                    <th>Cancelled</th>
                    <th>Completed</th>
                    <th>Exited</th>
                    <th>Code Reveals</th>
                    <th>Wood Valley</th>
                    <th>Honanui</th>
                    <th>Ainapo</th>
                    <th>Last Request</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSummary.map((row) => (
                    <tr key={row.access_account_id}>
                      <td>{row.access_id || "—"}</td>
                      <td>{fullName(row.first_name, row.last_name)}</td>
                      <td>{row.email || "—"}</td>
                      <td>
                        <StatusBadge label={row.account_status || "active"} />
                      </td>
                      <td>{row.total_requests}</td>
                      <td>{row.approved_requests}</td>
                      <td>{row.pending_requests}</td>
                      <td>{row.denied_requests}</td>
                      <td>{row.cancelled_requests}</td>
                      <td>{row.completed_requests}</td>
                      <td>{row.exited_requests}</td>
                      <td>{row.gate_code_reveals}</td>
                      <td>{row.wood_valley_requests}</td>
                      <td>{row.honanui_requests}</td>
                      <td>{row.ainapo_requests}</td>
                      <td>{formatDate(row.last_request_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeReport === "systemLog" && (
        <Card title="System Activity Log">
          {loading ? (
            <p className="muted-text">Loading system activity...</p>
          ) : filteredSystemLog.length === 0 ? (
            <p className="muted-text">
              No system activity records match the current filters.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Occurred At</th>
                    <th>Action</th>
                    <th>Severity</th>
                    <th>Summary</th>
                    <th>Actor</th>
                    <th>Source</th>
                    <th>Entity</th>
                    <th>Details</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSystemLog.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.occurred_at)}</td>
                      <td>{row.action}</td>
                      <td>
                        <span className={severityClass(row.severity)}>
                          {row.severity}
                        </span>
                      </td>
                      <td>{row.summary}</td>
                      <td>{row.actor_email || "—"}</td>
                      <td>{row.source || "—"}</td>
                      <td>{row.entity_type || "—"}</td>
                      <td style={{ maxWidth: "420px" }}>
                        <code
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {detailsText(row.details)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </AppShell>
  );
}