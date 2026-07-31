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
    let cancelled = false;

    async function prepareSession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        /*
         * First check whether Supabase has already restored the recovery
         * session. This can happen when the recovery verification endpoint
         * redirects back after successfully authenticating the user.
         */
        const {
          data: { session: existingSession },
          error: existingSessionError,
        } = await supabase.auth.getSession();

        if (existingSessionError) {
          throw existingSessionError;
        }

        /*
         * Only exchange a PKCE authorization code when there is not already
         * an authenticated recovery session.
         */
        if (code && !existingSession) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }
        }

        if (code) {
          url.searchParams.delete("code");
          window.history.replaceState(
            {},
            document.title,
            `${url.pathname}${url.search}`
          );
        }

        /*
         * Legacy implicit recovery flow:
         * Tokens are returned in the URL fragment after "#".
         * Server routes cannot read these values, so handle them here.
         */
        const fragment = new URLSearchParams(
          window.location.hash.replace(/^#/, "")
        );

        const fragmentError =
          fragment.get("error_description") ||
          fragment.get("error");

        if (fragmentError) {
          throw new Error(
            decodeURIComponent(fragmentError.replace(/\+/g, " "))
          );
        }

        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) {
            throw sessionError;
          }

          window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}${window.location.search}`
          );
        }

        const {
          data: { session },
          error: sessionLookupError,
        } = await supabase.auth.getSession();

        if (sessionLookupError) {
          throw sessionLookupError;
        }

        if (!session) {
          throw new Error(
            "This password reset link is invalid or expired. Please request a new link."
          );
        }

        if (!cancelled) {
          setReady(true);
          setError("");
        }
      } catch (sessionError) {
        console.error("Unable to prepare password reset session.");

        if (!cancelled) {
          setReady(false);
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : "This password reset link is invalid or expired. Please request a new link."
          );
        }
      }
    }

    void prepareSession();

    return () => {
      cancelled = true;
    };
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
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    setMessage("Password saved. You can now sign in.");

    window.setTimeout(() => {
      window.location.href = "/";
    }, 1200);

    setLoading(false);
  }

  return (
    <Card title="Create Password">
      <div className="mobile-form-stack">
        {message && (
          <div className="success-callout">{message}</div>
        )}

        {error && (
          <div className="error-callout">{error}</div>
        )}

        {!ready && !error && (
          <div className="info-callout">
            Verifying your password reset link...
          </div>
        )}

        <label>
          New Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!ready || loading}
            autoComplete="new-password"
          />
        </label>

        <label>
          Confirm Password
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            disabled={!ready || loading}
            autoComplete="new-password"
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
