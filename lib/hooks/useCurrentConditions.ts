"use client";

import { useEffect, useState } from "react";

export type CurrentConditions = {
  weather: {
    label: string;
    condition: string;
    temperature: number | null;
  } | null;
  gates: {
    id: string;
    name: string;
    status: string;
  }[];
  fireStatus: string;
  roadStatus: string;
  roadNotes: string;
  lastUpdated: string;
};

export function useCurrentConditions() {
  const [conditions, setConditions] = useState<CurrentConditions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadConditions() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/current-conditions");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load current conditions.");
      }

      setConditions({
        weather: result.weather,
        gates: result.gates ?? [],
        fireStatus: result.fireStatus,
        roadStatus: result.roadStatus,
        roadNotes: result.roadNotes,
        lastUpdated: result.lastUpdated,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConditions();
  }, []);

  return {
    conditions,
    loading,
    error,
    refresh: loadConditions,
  };
}