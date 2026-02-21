"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface LoginFormProps {
  onSuccess?: () => void;
}

type Mode = "login" | "signup";

export function LoginForm({ onSuccess }: LoginFormProps) {
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
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
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
        setError("このメールアドレスは既に登録されています。");
        return;
      }
      setSuccessMessage(
        "アカウントを作成しました。メール確認が有効な場合は、送信されたリンクから確認してください。"
      );
      setPassword("");
      if (data?.session) {
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";
  const handleSubmit = isLogin ? handleLogin : handleSignUp;

  return (
    <div className="max-w-sm mx-auto mt-8 p-6 border rounded-lg bg-card">
      <h2 className="text-xl font-semibold mb-4">{isLogin ? "ログイン" : "新規登録"}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="パスワード"
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
              ? "ログイン中..."
              : "登録中..."
            : isLogin
              ? "ログイン"
              : "アカウントを作成"}
        </Button>
      </form>
      <div className="mt-4 pt-4 border-t">
        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? "signup" : "login");
            setError(null);
            setSuccessMessage(null);
          }}
          className="text-sm text-primary hover:underline"
        >
          {isLogin ? "新規登録はこちら" : "すでにアカウントがある方はログイン"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        新規登録後、profiles テーブルで「私」か「弟」を設定するとカレンダーで色分けされます。
      </p>
    </div>
  );
}
