import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("WELCOME_EMAIL_FROM") || "operations@kapapalaranch.com";
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) throw new Error("Missing required email configuration.");

    const body = await req.json();
    const requestId = String(body.request_id || "").trim();
    const reason = String(body.reason || "").trim();
    if (!requestId || !reason) return json({ success: false, error: "request_id and reason are required." }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: accessRequest, error } = await supabase
      .from("daily_access_requests")
      .select(`
        id, request_date, status,
        gates ( name ),
        access_accounts (
          applicant_first_name, applicant_email,
          profiles!access_accounts_profile_id_fkey ( first_name, email )
        )
      `)
      .eq("id", requestId)
      .single();

    if (error || !accessRequest) throw new Error(error?.message || "Access request not found.");

    const account: any = Array.isArray((accessRequest as any).access_accounts)
      ? (accessRequest as any).access_accounts[0]
      : (accessRequest as any).access_accounts;
    const profile: any = Array.isArray(account?.profiles) ? account.profiles[0] : account?.profiles;
    const gate: any = Array.isArray((accessRequest as any).gates)
      ? (accessRequest as any).gates[0]
      : (accessRequest as any).gates;

    const to = profile?.email?.trim() || account?.applicant_email?.trim();
    if (!to) return json({ success: false, error: "User has no email address." }, 400);

    const firstName = profile?.first_name?.trim() || account?.applicant_first_name?.trim() || "Kapāpala Access User";
    const gateName = gate?.name || "Kapāpala Forest Reserve";
    const date = String((accessRequest as any).request_date || "");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject: `Kapāpala access request cancelled – ${gateName}`,
        html: buildHtml(firstName, gateName, date, reason),
      }),
    });

    const result = await safeJson(response);
    if (!response.ok) return json({ success: false, error: "Cancellation email failed.", details: result }, 500);
    return json({ success: true, to, resend: result });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function safeJson(response: Response) {
  try { return await response.json(); } catch { return { status: response.status }; }
}

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function buildHtml(firstName: string, gateName: string, date: string, reason: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2933;max-width:640px;margin:0 auto">
      <h2 style="color:#7f1d1d">Kapāpala Access Request Cancelled</h2>
      <p>Aloha ${esc(firstName)},</p>
      <p>Your previously approved Kapāpala Forest Reserve access request has been cancelled.</p>
      <div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:16px;margin:20px 0">
        <p style="margin:0 0 8px"><strong>Gate:</strong> ${esc(gateName)}</p>
        <p style="margin:0 0 8px"><strong>Date:</strong> ${esc(date)}</p>
        <p style="margin:0"><strong>Reason:</strong> ${esc(reason)}</p>
      </div>
      <p>The gate code will no longer be available for this cancelled request.</p>
      <p>Mahalo,<br>Kapāpala Forest Reserve Access</p>
    </div>
  `;
}
