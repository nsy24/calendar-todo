"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface LoginFormProps {
  onSuccess?: () => void;
}

type Mode = "login" | "signup";

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      if (data?.user && !data.user.identities?.length) {
        setError(t("auth.emailTaken"));
        return;
      }
      setSuccessMessage(t("auth.signupSuccess"));
      setPassword("");
      if (data?.session) {
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.signupFailed"));
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";
  const handleSubmit = isLogin ? handleLogin : handleSignUp;

  return (
    <div className="max-w-sm mx-auto mt-8 p-6 border rounded-2xl border-slate-200/80 bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">{isLogin ? t("auth.login") : t("auth.signup")}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading
            ? isLogin
              ? t("auth.loginProgress")
              : t("auth.creatingAccount")
            : isLogin
              ? t("auth.login")
              : t("auth.createAccount")}
        </Button>
      </form>
      <div className="mt-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? "signup" : "login");
            setError(null);
            setSuccessMessage(null);
          }}
          className="text-sm text-primary hover:underline"
        >
          {isLogin ? t("auth.signupLink") : t("auth.loginLink")}
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-4">
        {t("auth.welcomeMessage")}
      </p>
    </div>
  );
}