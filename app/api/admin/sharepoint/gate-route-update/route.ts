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

export async function POST(request: Request) {
  try {
    const webhookUrl = process.env.SHAREPOINT_GATE_CODE_UPDATE_WEBHOOK_URL;

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

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();

      return NextResponse.json(
        {
          success: false,
          error: "Power Automate rejected the gate code update.",
          details: responseText,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
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