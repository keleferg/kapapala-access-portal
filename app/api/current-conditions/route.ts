import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from "@/lib/supabaseAdmin";

type GateRow = {
  id: string;
  name: string;
  status: string | null;
  road_condition: string | null;
  public_note: string | null;
  notes: string | null;
  active: boolean | null;
};

const KAPAPALA_LATITUDE = 19.283;
const KAPAPALA_LONGITUDE = -155.45;

const weatherCodeLabels: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Depositing Rime Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  56: "Freezing Drizzle",
  57: "Heavy Freezing Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Heavy Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Light Showers",
  81: "Showers",
  82: "Heavy Showers",
  85: "Light Snow Showers",
  86: "Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm With Hail",
  99: "Severe Thunderstorm With Hail",
};

function normalizeStatus(value: string | null | undefined) {
  return value ? value.toString() : "Unknown";
}

function deriveRoadStatus(gates: GateRow[]) {
  const values = gates
    .map((gate) => gate.road_condition?.trim())
    .filter(Boolean) as string[];

  if (values.length === 0) {
    const hasClosedGate = gates.some(
      (gate) => normalizeStatus(gate.status).toLowerCase() === "closed"
    );

    const hasRestrictedGate = gates.some(
      (gate) => normalizeStatus(gate.status).toLowerCase() === "restricted"
    );

    if (hasClosedGate) return "Restricted";
    if (hasRestrictedGate) return "Caution";

    return "Open";
  }

  const lowerValues = values.map((value) => value.toLowerCase());

  if (
    lowerValues.some(
      (value) =>
        value.includes("closed") ||
        value.includes("impassable") ||
        value.includes("no access")
    )
  ) {
    return "Closed";
  }

  if (
    lowerValues.some(
      (value) =>
        value.includes("4wd") ||
        value.includes("caution") ||
        value.includes("fair") ||
        value.includes("mud") ||
        value.includes("restricted")
    )
  ) {
    return "Caution";
  }

  return "Open";
}

function buildRoadNotes(gates: GateRow[]) {
  const notes = gates
    .map((gate) => {
      const note = gate.public_note || gate.notes;

      if (!note) return null;

      return `${gate.name}: ${note}`;
    })
    .filter(Boolean);

  if (notes.length === 0) {
    return "No current access restrictions posted.";
  }

  return notes.join(" ");
}

function deriveFireStatus(gates: GateRow[]) {
  const combinedText = gates
    .map((gate) =>
      [
        gate.status,
        gate.road_condition,
        gate.public_note,
        gate.notes,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ")
    .toLowerCase();

  if (
    combinedText.includes("fire danger high") ||
    combinedText.includes("high fire") ||
    combinedText.includes("red flag")
  ) {
    return "High";
  }

  if (
    combinedText.includes("fire danger elevated") ||
    combinedText.includes("elevated fire") ||
    combinedText.includes("dry conditions")
  ) {
    return "Elevated";
  }

  return "Normal";
}

async function loadWeather() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");

  url.searchParams.set("latitude", String(KAPAPALA_LATITUDE));
  url.searchParams.set("longitude", String(KAPAPALA_LONGITUDE));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "Pacific/Honolulu");

  const response = await fetch(url.toString(), {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error("Unable to load weather.");
  }

  const data = await response.json();
  const current = data.current;

  if (!current) {
    return {
      label: "Kapāpala",
      condition: "Unavailable",
      temperature: null,
    };
  }

  const weatherCode =
    typeof current.weather_code === "number" ? current.weather_code : null;

  return {
    label: "Kapāpala",
    condition:
      weatherCode !== null
        ? weatherCodeLabels[weatherCode] || "Current Conditions"
        : "Current Conditions",
    temperature:
      typeof current.temperature_2m === "number"
        ? Math.round(current.temperature_2m)
        : null,
  };
}

export async function GET() {
  try {
    let gates: GateRow[] = [];

    if (isSupabaseAdminConfigured()) {
      const supabase = getSupabaseAdmin();

      const { data, error } = await (supabase as any)
        .from("gates")
        .select("id,name,status,road_condition,public_note,notes,active")
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      gates = (data ?? []) as GateRow[];
    }

    let weather = null;

    try {
      weather = await loadWeather();
    } catch (error) {
      console.error("Weather load failed:", error);

      weather = {
        label: "Kapāpala",
        condition: "Unavailable",
        temperature: null,
      };
    }

    return NextResponse.json({
      success: true,
      weather,
      gates: gates.map((gate) => ({
        id: gate.id,
        name: gate.name,
        status: normalizeStatus(gate.status),
      })),
      fireStatus: deriveFireStatus(gates),
      roadStatus: deriveRoadStatus(gates),
      roadNotes: buildRoadNotes(gates),
      lastUpdated: new Date().toISOString(),
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