"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { format, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, LogOut, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LoginForm } from "@/components/LoginForm";
import { cn } from "@/lib/utils";
import { validateUsername } from "@/lib/validation";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  date: Date;
  createdByUsername?: string | null;
}

interface Profile {
  username: string | null;
}

interface PendingRequest {
  id: string;
  applicant_username: string;
}

interface ActiveShare {
  id: string;
  partner_user_id: string;
  partner_username: string;
}

export default function Home() {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activePartners, setActivePartners] = useState<ActiveShare[]>([]);
  const [newPartnerInput, setNewPartnerInput] = useState("");
  const [addPartnerLoading, setAddPartnerLoading] = useState(false);
  const [addPartnerError, setAddPartnerError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());
  const profileRef = useRef(profile);
  const activePartnerUsernamesRef = useRef<string[]>([]);
  const sessionRef = useRef(session);
  profileRef.current = profile;
  activePartnerUsernamesRef.current = activePartners.map((p) => p.partner_username);
  sessionRef.current = session;

  const addToast = React.useCallback((message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

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
      .select("username")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch profile", error);
      setProfile(null);
    } else {
      setProfile({ username: data?.username ?? null });
    }
    setProfileLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fetchShares = React.useCallback(async () => {
    if (!session?.user?.id) return;
    const myId = session.user.id;
    const { data: pendingRows, error: pendingErr } = await supabase
      .from("shares")
      .select("id,owner_id")
      .eq("receiver_id", myId)
      .eq("status", "pending");
    if (pendingErr) {
      console.error("Failed to fetch pending shares", pendingErr);
    }
    const applicantIds = (pendingRows || []).map((r: { owner_id: string }) => r.owner_id);
    const pendingWithNames: PendingRequest[] = [];
    if (applicantIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", applicantIds);
      const nameById = new Map((profiles || []).map((p: { id: string; username: string | null }) => [p.id, p.username ?? "?"]));
      pendingRows?.forEach((r: { id: string; owner_id: string }) => {
        pendingWithNames.push({ id: r.id, applicant_username: nameById.get(r.owner_id) ?? "?" });
      });
    }
    setPendingRequests(pendingWithNames);

    const { data: activeRows, error: activeErr } = await supabase
      .from("shares")
      .select("id,owner_id,receiver_id")
      .or(`owner_id.eq.${myId},receiver_id.eq.${myId}`)
      .eq("status", "active");
    if (activeErr) {
      console.error("Failed to fetch active shares", activeErr);
      setActivePartners([]);
      return;
    }
    const partnerIds = (activeRows || []).map((r: { owner_id: string; receiver_id: string }) => (r.owner_id === myId ? r.receiver_id : r.owner_id));
    const activeWithNames: ActiveShare[] = [];
    if (partnerIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", partnerIds);
      const nameById = new Map((profiles || []).map((p: { id: string; username: string | null }) => [p.id, p.username ?? "?"]));
      activeRows?.forEach((r: { id: string; owner_id: string; receiver_id: string }) => {
        const partnerId = r.owner_id === myId ? r.receiver_id : r.owner_id;
        activeWithNames.push({ id: r.id, partner_user_id: partnerId, partner_username: nameById.get(partnerId) ?? "?" });
      });
    }
    setActivePartners(activeWithNames);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session) return;
    fetchShares();
  }, [session, fetchShares]);

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
  }, [session, activePartners]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("todos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const myUsername = profileRef.current?.username?.trim();
          const newRow = payload.new as { title?: string; completed?: boolean; created_by_username?: string | null; user_id?: string } | null;
          const oldRow = payload.old as { title?: string; completed?: boolean; created_by_username?: string | null } | null;
          const who = (newRow?.created_by_username || oldRow?.created_by_username || "").trim() || "誰か";
          const isFromMe = who === myUsername;
          const partners = activePartnerUsernamesRef.current;
          const isFromPartner = who && who !== myUsername && partners.includes(who);
          if (isFromMe) {
            fetchTodos();
            return;
          }
          if (payload.eventType === "INSERT" && newRow?.title && isFromPartner) {
            addToast(`${who}さんがタスク「${newRow.title}」を追加しました`);
          } else if (payload.eventType === "UPDATE" && newRow && oldRow) {
            const becameCompleted = newRow.completed === true && oldRow.completed !== true;
            const uncompleted = newRow.completed === false && oldRow.completed === true;
            if (newRow.title && isFromPartner) {
              if (becameCompleted) addToast(`${who}さんがタスク「${newRow.title}」を完了しました`);
              else if (uncompleted) addToast(`${who}さんがタスク「${newRow.title}」の完了を解除しました`);
            }
          }
          fetchTodos();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, addToast]);

  async function fetchTodos() {
    if (!session?.user?.id) return;
    const partnerUserIds = activePartners.map((p) => p.partner_user_id);
    const myRes = await supabase
      .from("todos")
      .select("id,title,completed,date,created_by_username")
      .eq("user_id", session.user.id)
      .order("date", { ascending: true });
    if (myRes.error) {
      console.error("Failed to fetch todos", myRes.error);
      alert("予定の取得に失敗しました: " + (myRes.error.message || JSON.stringify(myRes.error)));
      return;
    }
    let allRows: any[] = [...(myRes.data || [])];
    if (partnerUserIds.length > 0) {
      const partnerRes = await supabase
        .from("todos")
        .select("id,title,completed,date,created_by_username")
        .in("user_id", partnerUserIds)
        .order("date", { ascending: true });
      if (!partnerRes.error && partnerRes.data?.length) {
        const myIds = new Set((myRes.data || []).map((r: any) => r.id));
        partnerRes.data.forEach((r: any) => {
          if (!myIds.has(r.id)) allRows.push(r);
        });
      }
    }
    allRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const mapped: Todo[] = allRows.map((r: any) => ({
      id: String(r.id),
      text: r.title,
      completed: r.completed,
      date: new Date(r.date),
      createdByUsername: r.created_by_username ?? null,
    }));
    setTodos(mapped);
  }

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    const errMsg = validateUsername(newPartnerInput);
    if (errMsg) {
      setAddPartnerError(errMsg);
      return;
    }
    const username = newPartnerInput.trim();
    if (username.toLowerCase() === profile?.username?.trim().toLowerCase()) {
      setAddPartnerError("自分には申請できません");
      return;
    }
    setAddPartnerError(null);
    setAddPartnerLoading(true);
    const { data: profileRow, error: lookupErr } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    setAddPartnerLoading(false);
    if (lookupErr || !profileRow?.id) {
      setAddPartnerError("そのユーザー名のユーザーが見つかりません");
      return;
    }
    if (profileRow.id === session!.user.id) {
      setAddPartnerError("自分には申請できません");
      return;
    }
    setAddPartnerLoading(true);
    const { error } = await supabase
      .from("shares")
      .insert({ owner_id: session!.user.id, receiver_id: profileRow.id, status: "pending" });
    setAddPartnerLoading(false);
    if (error) {
      if (error.code === "23505") setAddPartnerError("既に申請済みか、共有済みです");
      else setAddPartnerError(error.message);
      return;
    }
    setNewPartnerInput("");
    addToast("共有申請を送りました");
    fetchShares();
  };

  const handleApprove = async (shareId: string) => {
    const { error } = await supabase.from("shares").update({ status: "active" }).eq("id", shareId).eq("receiver_id", session!.user.id);
    if (error) {
      console.error("Approve error", error);
      addToast("承認に失敗しました");
      return;
    }
    addToast("共有を承認しました");
    fetchShares().then(() => fetchTodos());
  };

  const handleUnshare = async (shareId: string) => {
    const { error } = await supabase.from("shares").delete().eq("id", shareId);
    if (error) {
      console.error("Unshare error", error);
      addToast("解除に失敗しました");
      return;
    }
    addToast("共有を解除しました");
    fetchShares().then(() => fetchTodos());
  };

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

  // 予定に2人以上のユーザーが含まれるときだけ色分けする
  const usernameColorMap = useMemo(() => {
    const names = [...new Set(todos.map((t) => t.createdByUsername).filter(Boolean))] as string[];
    names.sort();
    if (names.length < 2) return null;
    const colors = ["border-l-red-500", "border-l-blue-500", "border-l-green-500", "border-l-amber-500", "border-l-purple-500"];
    const map: Record<string, string> = {};
    names.forEach((name, i) => {
      map[name] = colors[i % colors.length];
    });
    return map;
  }, [todos]);

  const useUsernameColors = usernameColorMap !== null;

  const handleSubmit = async () => {
    if (!session?.user?.id || !profile?.username?.trim()) {
      console.error("handleSubmit: not logged in or username missing");
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
        .insert([{ title, date, user_id: session.user.id, created_by_username: profile.username.trim() }])
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

  const displayName = profile?.username?.trim() ?? "";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 relative">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">カレンダーTodoリスト</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{displayName}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="ログアウト">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Card className="mb-6">
          <CardHeader className="py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              共有申請・仲間
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <form onSubmit={handleApply} className="flex gap-2 flex-wrap items-center">
              <Input
                placeholder="仲間のユーザー名を入力（半角英数字・. _ -）"
                value={newPartnerInput}
                onChange={(e) => {
                  setNewPartnerInput(e.target.value);
                  setAddPartnerError(null);
                }}
                className="max-w-xs"
              />
              <Button type="submit" disabled={addPartnerLoading}>
                {addPartnerLoading ? "送信中..." : "申請を送る"}
              </Button>
            </form>
            {addPartnerError && <p className="text-sm text-destructive">{addPartnerError}</p>}
            {pendingRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">申請が届いています</p>
                <ul className="space-y-1">
                  {pendingRequests.map((req) => (
                    <li key={req.id} className="flex items-center justify-between gap-2 rounded border px-3 py-2">
                      <span className="text-sm">{req.applicant_username}さんから共有申請</span>
                      <Button size="sm" onClick={() => handleApprove(req.id)}>
                        承認する
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {activePartners.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">共有中（仲間の予定がカレンダーに表示されます）</p>
                <ul className="space-y-1">
                  {activePartners.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded border px-3 py-2">
                      <span className="text-sm">{p.partner_username}</span>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleUnshare(p.id)}>
                        解除
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
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
              {useUsernameColors && usernameColorMap && (
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {Object.entries(usernameColorMap).map(([name, borderClass]) => (
                    <span key={name} className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block w-3 h-3 rounded-sm",
                          borderClass === "border-l-red-500" && "bg-red-500",
                          borderClass === "border-l-blue-500" && "bg-blue-500",
                          borderClass === "border-l-green-500" && "bg-green-500",
                          borderClass === "border-l-amber-500" && "bg-amber-500",
                          borderClass === "border-l-purple-500" && "bg-purple-500"
                        )}
                      />
                      {name}
                    </span>
                  ))}
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
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors border-l-4",
                        useUsernameColors && todo.createdByUsername && usernameColorMap?.[todo.createdByUsername]
                          ? usernameColorMap[todo.createdByUsername]
                          : "border-l-muted"
                      )}
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
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg border bg-card px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right-5 duration-300"
          >
            {t.message}
          </div>
        ))}
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
    const errMsg = validateUsername(username);
    if (errMsg) {
      setError(errMsg);
      return;
    }
    const value = username.trim();
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
        const { error: err } = await supabase.from("profiles").insert({ id: session.user.id, username: value }).select();
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
            placeholder="半角英数字・記号（. _ -）2〜50文字"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={2}
            maxLength={50}
          />
        <p className="text-xs text-muted-foreground">半角英数字と記号（. _ -）のみ使用できます</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "設定中..." : "設定する"}
          </Button>
        </form>
      </div>
    </div>
  );
}
