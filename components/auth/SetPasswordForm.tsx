"use client";

import { useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import Card from "../ui/Card";

export default function SetPasswordForm() {
  const supabase = getSupabaseClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password saved. You can now sign in.");
      setTimeout(() => {
        window.location.href = "/login";
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
          />
        </label>

        <label>
          Confirm Password
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>

        <button
          className="button primary"
          type="button"
          onClick={updatePassword}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Password"}
        </button>
      </div>
    </Card>
  );
}