import { NextResponse } from "next/server";

type GateCodeUpdatePayload = {
  gateName: string;
  gateId: string;
  comboId: string;
  code: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  updatedBy?: string | null;
  updatedAt: string;
};

type SharePointGateCodePayload = GateCodeUpdatePayload & {
  syncSource: "kapapala-app";
  syncEventId: string;
};

export async function POST(request: Request) {
  try {
    const webhookUrl =
      process.env.SHAREPOINT_GATE_CODE_UPDATE_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing SHAREPOINT_GATE_CODE_UPDATE_WEBHOOK_URL environment variable.",
        },
        { status: 500 }
      );
    }

    const payload = (await request.json()) as GateCodeUpdatePayload;

    if (!payload.gateName || !payload.gateId || !payload.comboId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required gate code update fields.",
        },
        { status: 400 }
      );
    }

    if (!payload.code || !payload.validFrom || !payload.validUntil) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing gate code, validFrom, or validUntil.",
        },
        { status: 400 }
      );
    }

    if (!payload.updatedAt) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing updatedAt.",
        },
        { status: 400 }
      );
    }

    /*
     * This value identifies one specific app-originated change.
     *
     * If Power Automate retries the same request, it receives the same
     * event identifier rather than treating the retry as a new change.
     */
    const syncEventId = [
      "kapapala-app",
      payload.comboId,
      payload.updatedAt,
    ].join(":");

    const sharePointPayload: SharePointGateCodePayload = {
      ...payload,
      syncSource: "kapapala-app",
      syncEventId,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",

        /*
         * These are informational markers for Power Automate.
         * The values are also included in the JSON body because
         * Power Automate handles body fields more easily than headers.
         */
        "X-Kapapala-Sync-Source": "kapapala-app",
        "Idempotency-Key": syncEventId,
      },
      body: JSON.stringify(sharePointPayload),
      cache: "no-store",
    });

    if (!response.ok) {
      const responseText = await response.text();

      console.error("Power Automate rejected gate-code update", {
        status: response.status,
        syncEventId,
        responseText,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Power Automate rejected the gate code update.",
          details: responseText,
          syncEventId,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      syncSource: "kapapala-app",
      syncEventId,
    });
  } catch (error) {
    console.error("SharePoint gate code update bridge failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown SharePoint gate code update bridge error.",
      },
      { status: 500 }
    );
  }
}