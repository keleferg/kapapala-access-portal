"use client";

import { useEffect, useState } from "react";

export type TimelineEvent = {
  id: string;
  event_type: string;
  event_title: string;
  event_body: string | null;
  created_at: string;
};

export function useAccountTimeline(accountId: string) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTimeline() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/timeline`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load timeline.");
      }

      setEvents(result.events ?? []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (accountId) {
      loadTimeline();
    }
  }, [accountId]);

  return {
    events,
    loading,
    error,
    refresh: loadTimeline,
  };
}