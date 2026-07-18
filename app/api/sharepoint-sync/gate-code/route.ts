import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

type SharePointGateCodePayload = {
  gateId?: unknown;
  gateName?: unknown;
  code?: unknown;
  validFrom?: unknown;
  sharepointItemId?: unknown;
  modifiedAt?: unknown;
  syncEventId?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeGateName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ʻ’']/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function authorizeRequest(request: Request): boolean {
  const expectedSecret = process.env.SHAREPOINT_SYNC_SECRET;
  const providedSecret = request.headers.get("x-sharepoint-sync-secret");

  return Boolean(expectedSecret && providedSecret === expectedSecret);
}

export async function POST(request: Request) {
  try {
    if (!authorizeRequest(request)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized SharePoint sync request.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SharePointGateCodePayload;

    const suppliedGateId = readString(body.gateId);
    const suppliedGateName = readString(body.gateName);
    const code = readString(body.code);
    const validFrom = readString(body.validFrom);
    const syncEventId = readString(body.syncEventId);
    const modifiedAt = readString(body.modifiedAt);

    if (!suppliedGateId && !suppliedGateName) {
      return NextResponse.json(
        {
          success: false,
          error: "Provide either gateId or gateName.",
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing gate combination.",
        },
        { status: 400 }
      );
    }

    if (!validFrom || !/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
      return NextResponse.json(
        {
          success: false,
          error: "validFrom must use YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    if (suppliedGateId && !UUID_PATTERN.test(suppliedGateId)) {
      return NextResponse.json(
        {
          success: false,
          error: "gateId is not a valid UUID.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    let resolvedGate:
      | {
          id: string;
          name: string;
        }
      | null = null;

    /*
     * Prefer the permanent Supabase gate UUID when Power Automate provides it.
     */
    if (suppliedGateId) {
      const { data, error } = await supabase
        .from("gates")
        .select("id, name")
        .eq("id", suppliedGateId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      resolvedGate = data;
    } else if (suppliedGateName) {
      /*
       * Gate-name matching tolerates Ainapo/ʻĀinapō apostrophe and accent
       * differences. Once possible, store gateId in SharePoint and use that.
       */
      const { data, error } = await supabase
        .from("gates")
        .select("id, name")
        .order("name");

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      const normalizedRequestedName = normalizeGateName(suppliedGateName);

      resolvedGate =
        data?.find(
          (gate) =>
            normalizeGateName(gate.name ?? "") === normalizedRequestedName
        ) ?? null;
    }

    if (!resolvedGate) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to match the SharePoint record to a gate.",
          gateId: suppliedGateId,
          gateName: suppliedGateName,
        },
        { status: 404 }
      );
    }

    /*
     * This RPC updates Supabase directly and never invokes the outbound
     * SharePoint webhook. It also returns changed=false when the app already
     * contains the same gate code and effective date.
     */
    const { data, error } = await supabase.rpc(
      "apply_gate_combination_from_sharepoint",
      {
        p_gate_id: resolvedGate.id,
        p_combination: code,
        p_combination_date: validFrom,
      }
    );

    if (error) {
      console.error("Inbound SharePoint gate-code RPC failed:", {
        gateId: resolvedGate.id,
        gateName: resolvedGate.name,
        syncEventId,
        error,
      });

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Gate-code RPC returned no result.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      changed: Boolean(result.changed),
      reason: result.reason,
      comboId: result.combo_id,
      gateId: resolvedGate.id,
      gateName: resolvedGate.name,
      syncEventId,
      modifiedAt,
    });
  } catch (error) {
    console.error("Inbound SharePoint gate-code sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown inbound SharePoint gate-code sync error.",
      },
      { status: 500 }
    );
  }
}
