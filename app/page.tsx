"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { format, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LoginForm } from "@/components/LoginForm";

type OwnerRole = "me" | "sibling";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  date: Date;
  createdByRole?: OwnerRole | null;
}

interface Profile {
  role: OwnerRole | null;
  username: string | null;
}

export default function Home() {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s as { user: { id: string } } | null);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s as { user: { id: string } } | null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = React.useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("role,username")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch profile", error);
      setProfile(null);
    } else {
      setProfile({
        role: (data?.role as OwnerRole) ?? null,
        username: data?.username ?? null,
      });
    }
    setProfileLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!session) return;
    fetchTodos();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const t = setInterval(() => checkAndNotifyOverdue(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchTodos();
  }, [session, selectedDate]);

  async function fetchTodos() {
    const { data, error } = await supabase
      .from("todos")
      .select("id,title,completed,date,created_by_role")
      .order("date", { ascending: true });
    if (error) {
      console.error("Failed to fetch todos", error);
      alert("予定の取得に失敗しました: " + (error.message || JSON.stringify(error)));
      return;
    }
    const mapped: Todo[] = (data || []).map((r: any) => ({
      id: String(r.id),
      text: r.title,
      completed: r.completed,
      date: new Date(r.date),
      createdByRole: r.created_by_role ?? null,
    }));
    setTodos(mapped);
  }

  function checkAndNotifyOverdue() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    todos.forEach((t) => {
      const d = new Date(t.date.getFullYear(), t.date.getMonth(), t.date.getDate());
      if (d <= today && !t.completed && !notifiedRef.current.has(t.id)) {
        new Notification("未完了のTodoがあります", { body: `${format(t.date, "yyyy-MM-dd")}: ${t.text}` });
        notifiedRef.current.add(t.id);
      }
    });
  }

  const selectedDateTodos = useMemo(() => todos.filter((t) => isSameDay(t.date, selectedDate)), [todos, selectedDate]);

  const todosByDate = useMemo(() => {
    const map = new Map<string, number>();
    todos.forEach((todo) => {
      const key = format(todo.date, "yyyy-MM-dd");
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [todos]);

  // 予定に2人以上の role が含まれるときだけ色分けする
  const useRoleColors = useMemo(() => {
    const roles = new Set(todos.map((t) => t.createdByRole).filter(Boolean));
    return roles.size >= 2;
  }, [todos]);

  const handleSubmit = async () => {
    if (!session?.user?.id || !profile?.role) {
      console.error("handleSubmit: not logged in or profile role missing");
      return;
    }
    if (newTodoText.trim() === "") {
      console.error("handleSubmit: newTodoText is empty");
      return;
    }
    const title = newTodoText.trim();
    const date = format(selectedDate, "yyyy-MM-dd");
    try {
      const { data, error } = await supabase
        .from("todos")
        .insert([{ title, date, user_id: session.user.id, created_by_role: profile.role }])
        .select();
      if (error) {
        console.error("supabase insert error", error);
        alert("予定の追加に失敗しました: " + (error.message || JSON.stringify(error)));
        return;
      }
      if (data && data[0]) {
        try {
          await fetchTodos();
        } catch (e) {
          console.error("fetchTodos after insert error", e);
        }
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Todoを追加しました", { body: title });
        }
      } else {
        fetchTodos();
      }
    } catch (err) {
      console.error("handleSubmit unexpected error", err);
      alert("予定の追加に失敗しました");
    } finally {
      setNewTodoText("");
    }
  };

  const handleToggleTodo = async (id: string) => {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const newCompleted = !target.completed;
    const { error } = await supabase.from("todos").update({ completed: newCompleted }).eq("id", id);
    if (error) {
      console.error("update error", error);
      return;
    }
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: newCompleted } : t)));
  };

  const handleDeleteTodo = async (id: string) => {
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      console.error("delete error", error);
      return;
    }
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background p-4">
        <h1 className="text-2xl font-bold text-center mb-2">カレンダーTodoリスト</h1>
        <LoginForm />
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  const needsUsername = !profile || !profile.username?.trim();

  if (needsUsername) {
    return (
      <SetUsernameScreen
        session={session}
        profile={profile}
        onSuccess={fetchProfile}
      />
    );
  }

  const displayName = profile?.username?.trim() || (profile?.role === "me" ? "私" : profile?.role === "sibling" ? "弟" : "?");

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">カレンダーTodoリスト</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{displayName}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="ログアウト">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>カレンダー</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{format(selectedDate, "yyyy年M月d日")} のTodo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {useRoleColors && (
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> 私</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> 弟</span>
                </div>
              )}
              <div className="flex gap-2">
                <Input placeholder="新しいTodoを追加..." value={newTodoText} onChange={(e) => setNewTodoText(e.target.value)} onKeyPress={handleKeyPress} className="flex-1" />
                <Button onClick={handleSubmit} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {selectedDateTodos.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">この日にはTodoがありません</p>
                ) : (
                  selectedDateTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors border-l-4 ${
                        useRoleColors
                          ? todo.createdByRole === "me"
                            ? "border-l-red-500"
                            : todo.createdByRole === "sibling"
                              ? "border-l-blue-500"
                              : "border-l-muted"
                          : "border-l-muted"
                      }`}
                    >
                      <Checkbox checked={todo.completed} onChange={() => handleToggleTodo(todo.id)} />
                      <span className={`flex-1 ${todo.completed ? "line-through text-muted-foreground" : ""}`}>{todo.text}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTodo(todo.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SetUsernameScreen({
  session,
  profile,
  onSuccess,
}: {
  session: { user: { id: string } };
  profile: Profile | null;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = username.trim();
    if (!value) {
      setError("ユーザー名を入力してください");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (profile) {
        const { error: err } = await supabase.from("profiles").update({ username: value }).eq("id", session.user.id);
        if (err) {
          if (err.code === "23505") setError("このユーザー名は既に使われています");
          else setError(err.message);
          return;
        }
      } else {
        const { error: err } = await supabase.from("profiles").insert({ id: session.user.id, username: value, role: "me" }).select();
        if (err) {
          if (err.code === "23505") setError("このユーザー名は既に使われています");
          else setError(err.message);
          return;
        }
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-sm w-full p-6 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-2">ユーザー名を設定</h2>
        <p className="text-sm text-muted-foreground mb-4">他の人と共有するときに表示されます。一度設定すると変更できます。</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="ユーザー名（例: たろう）"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={1}
            maxLength={50}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "設定中..." : "設定する"}
          </Button>
        </form>
      </div>
    </div>
  );
}
