"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import Card from "../ui/Card";

export default function SetPasswordForm() {
  const supabase = getSupabaseClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function prepareSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(exchangeError.message);
          setReady(false);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "This password setup link is invalid or expired. Please request a new link."
        );
        setReady(false);
        return;
      }

      setReady(true);
    }

    void prepareSession();
  }, [supabase]);

  async function updatePassword() {
    setLoading(true);
    setMessage("");
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Password saved. You can now sign in.");
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    }

    setLoading(false);
  }

  return (
    <Card title="Create Password">
      <div className="mobile-form-stack">
        {message && <div className="success-callout">{message}</div>}
        {error && <div className="error-callout">{error}</div>}

        <label>
          New Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!ready || loading}
          />
        </label>

        <label>
          Confirm Password
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            disabled={!ready || loading}
          />
        </label>

        <button
          className="button primary"
          type="button"
          onClick={updatePassword}
          disabled={!ready || loading}
        >
          {loading ? "Saving..." : "Save Password"}
        </button>
      </div>
    </Card>
  );
}