"use client";

import { useState } from "react";
import Card from "../ui/Card";
import { getSupabaseClient } from "../../lib/supabaseClient";

type UserRole =
  | "user"
  | "admin"
  | "super_user"
  | "public_user"
  | string
  | null;

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function signIn() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const supabase = getSupabaseClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setErrorMessage(signInError.message);
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(userError?.message || "Unable to load signed-in user.");
        setLoading(false);
        return;
      }

      const { data: roleData, error: roleError } = await (supabase as any)
        .rpc("current_app_role");

      if (roleError) {
        console.error("Unable to load app role after sign in:", roleError);
        window.location.href = "/dashboard";
        return;
      }

      const userRole = roleData as UserRole;

      if (userRole === "admin" || userRole === "super_user") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (error) {
      console.error("Sign in failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in."
      );
      setLoading(false);
    }
  }

  async function sendPasswordSetup() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const trimmedEmail = email.trim();

      if (!trimmedEmail) {
        setErrorMessage("Please enter your email address first.");
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();

      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
        }
      );

      if (error) {
        setErrorMessage(error.message);
      } else {
        setMessage("Password reset link sent. Check your email.");
      }
    } catch (error) {
      console.error("Password setup failed:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send password reset link."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Sign In">
      <div className="mobile-form-stack">
        {message && <div className="success-callout">{message}</div>}
        {errorMessage && <div className="error-callout">{errorMessage}</div>}

        <label>
          Email
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button
          className="button primary"
          type="button"
          onClick={() => void signIn()}
          disabled={loading}
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>

        <button
          className="button secondary"
          type="button"
          onClick={() => void sendPasswordSetup()}
          disabled={loading || !email.trim()}
        >
          Reset Password
        </button>
      </div>
    </Card>
  );
}