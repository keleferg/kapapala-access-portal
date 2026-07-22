import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

const HAWAII_TIME_ZONE = "Pacific/Honolulu";
const RENEWAL_WINDOW_DAYS = 30;
const RENEWAL_TERM_YEARS = 2;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getHawaiiDateParts(date = new Date()): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: HAWAII_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  const day = Number(
    parts.find((part) => part.type === "day")?.value
  );

  if (!year || !month || !day) {
    throw new Error("Unable to determine the current Hawaiʻi date.");
  }

  return { year, month, day };
}

function formatDate({
  year,
  month,
  day,
}: DateParts): string {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function daysInMonth(
  year: number,
  month: number
): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addYears(
  date: DateParts,
  years: number
): DateParts {
  const targetYear = date.year + years;
  const maximumDay = daysInMonth(
    targetYear,
    date.month
  );

  return {
    year: targetYear,
    month: date.month,
    day: Math.min(date.day, maximumDay),
  };
}

function addDays(
  date: DateParts,
  days: number
): DateParts {
  const utcDate = new Date(
    Date.UTC(date.year, date.month - 1, date.day)
  );

  utcDate.setUTCDate(utcDate.getUTCDate() + days);

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

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

    const { data: existingAccount, error: loadError } =
      await (supabase as any)
        .from("access_accounts")
        .select(
          "id, access_id, status, expires_at"
        )
        .eq("id", id)
        .single();

    if (loadError || !existingAccount) {
      return NextResponse.json(
        {
          success: false,
          error:
            loadError?.message ||
            "Access account could not be found.",
        },
        { status: 404 }
      );
    }

    const todayParts = getHawaiiDateParts();
    const today = formatDate(todayParts);

    const renewalWindowEnd = formatDate(
      addDays(todayParts, RENEWAL_WINDOW_DAYS)
    );

    const status = String(
      existingAccount.status || ""
    ).toLowerCase();

    const expirationDate =
      existingAccount.expires_at
        ? String(existingAccount.expires_at).slice(0, 10)
        : null;

    const isExpiredAccount = status === "expired";

    const isActiveWithinRenewalWindow =
      status === "active" &&
      expirationDate !== null &&
      expirationDate >= today &&
      expirationDate <= renewalWindowEnd;

    if (
      !isExpiredAccount &&
      !isActiveWithinRenewalWindow
    ) {
      let errorMessage =
        "This account is not currently eligible for renewal.";

      if (status === "active" && expirationDate) {
        errorMessage =
          `This account may be renewed beginning 30 days before its expiration date of ${expirationDate}.`;
      } else if (status === "active" && !expirationDate) {
        errorMessage =
          "This active account does not have an expiration date and cannot be renewed.";
      } else if (
        ["suspended", "revoked", "denied", "pending"].includes(
          status
        )
      ) {
        errorMessage =
          `Accounts with a status of ${status} cannot be renewed through the standard renewal process.`;
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          eligibility: {
            status,
            expires_at: expirationDate,
            renewal_window_start: expirationDate
              ? formatDate(
                  addDays(
                    {
                      year: Number(expirationDate.slice(0, 4)),
                      month: Number(expirationDate.slice(5, 7)),
                      day: Number(expirationDate.slice(8, 10)),
                    },
                    -RENEWAL_WINDOW_DAYS
                  )
                )
              : null,
            current_hawaii_date: today,
          },
        },
        { status: 400 }
      );
    }

    const newExpiration = formatDate(
      addYears(todayParts, RENEWAL_TERM_YEARS)
    );

    const { data, error } = await (supabase as any)
      .from("access_accounts")
      .update({
        status: "active",
        expires_at: newExpiration,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, access_id, status, expires_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    await (supabase as any)
      .from("timeline_events")
      .insert({
        access_account_id: id,
        event_type: "access_account_renewed",
        event_title: "Access Account Renewed",
        event_body:
          `Access account renewed on ${today} ` +
          `through ${newExpiration}.`,
      });

    return NextResponse.json({
      success: true,
      account: data,
      renewed_on: today,
      expires_at: newExpiration,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}
