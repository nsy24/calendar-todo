"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { format, isSameDay, startOfWeek, endOfWeek, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, LogOut, UserPlus, FileText, Copy, Bell, GripVertical, Clock, List, Pencil, ChevronDown, RefreshCw } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/lib/supabase";
import { LoginForm } from "@/components/LoginForm";
import { cn } from "@/lib/utils";
import { validateUsername } from "@/lib/validation";

type Priority = "high" | "medium" | "low";

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL: Record<Priority, string> = { high: "高", medium: "中", low: "低" };
const PRIORITY_DOT_CLASS: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  date: Date;
  createdByUsername?: string | null;
  priority: Priority;
  position: number;
  userId?: string;
  reminderTime?: string | null;
  reminderDate?: string | null;
  isMonthlyRecurring?: boolean;
}

interface Profile {
  username: string | null;
  avatar_seed: string | null;
}

const AVATAR_BASE = "https://api.dicebear.com/7.x/avataaars/svg";

function getAvatarUrl(seed: string): string {
  const s = (seed || "default").trim() || "default";
  return `${AVATAR_BASE}?seed=${encodeURIComponent(s)}`;
}

function Avatar({ seed, size = 32, className }: { seed: string; size?: number; className?: string }) {
  return (
    <img
      src={getAvatarUrl(seed)}
      alt=""
      width={size}
      height={size}
      className={cn("rounded-full shrink-0 bg-muted", className)}
    />
  );
}

function SortableTodoRow({
  todo,
  useUsernameColors,
  usernameColorMap,
  getAvatarSeedForUsername,
  onToggle,
  onChangePriority,
  onDelete,
}: {
  todo: Todo;
  useUsernameColors: boolean;
  usernameColorMap: Record<string, string> | null;
  getAvatarSeedForUsername: (name: string) => string;
  onToggle: (id: string) => void;
  onChangePriority: (id: string, priority: Priority) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const todoUserSeed = getAvatarSeedForUsername(todo.createdByUsername ?? "");
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors border-l-4",
        useUsernameColors && todo.createdByUsername && usernameColorMap?.[todo.createdByUsername]
          ? usernameColorMap[todo.createdByUsername]
          : "border-l-muted",
        isDragging && "opacity-95 shadow-xl scale-[1.02] z-50 ring-2 ring-primary/20"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 rounded">
        <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <Avatar seed={todoUserSeed} size={32} />
      <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT_CLASS[todo.priority])} title={`優先度: ${PRIORITY_LABEL[todo.priority]}`} />
      <Checkbox checked={todo.completed} onChange={() => onToggle(todo.id)} />
      <span className={`flex-1 ${todo.completed ? "line-through text-muted-foreground" : ""}`}>{todo.text}</span>
      <select
        value={todo.priority}
        onChange={(e) => onChangePriority(todo.id, e.target.value as Priority)}
        className="rounded border bg-background px-2 py-1 text-xs"
        title="優先度を変更"
      >
        <option value="high">高</option>
        <option value="medium">中</option>
        <option value="low">低</option>
      </select>
      <Button variant="ghost" size="icon" onClick={() => onDelete(todo.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
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

interface NotificationRow {
  id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface CalendarItem {
  id: string;
  name: string;
  created_by: string;
}

interface ReceivedInvitation {
  id: string;
  calendar_id: string;
  calendar_name: string;
  invited_by_username: string;
}

export default function Home() {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [calendarsList, setCalendarsList] = useState<CalendarItem[]>([]);
  const [currentCalendarId, setCurrentCalendarId] = useState<string | null>(null);
  const [calendarsLoading, setCalendarsLoading] = useState(true);
  const [calendarsReconnecting, setCalendarsReconnecting] = useState(false);
  const [calendarsEmptyPrompt, setCalendarsEmptyPrompt] = useState<string | null>(null);
  const [calendarsAutoCreating, setCalendarsAutoCreating] = useState(false);
  const [showCreateCalendarModal, setShowCreateCalendarModal] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const [createCalendarLoading, setCreateCalendarLoading] = useState(false);
  const [createCalendarError, setCreateCalendarError] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderMode, setReminderMode] = useState<"time" | "date">("date");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderMonthly, setReminderMonthly] = useState(false);
  const [reminderDayOfMonth, setReminderDayOfMonth] = useState(1);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [showReminderListModal, setShowReminderListModal] = useState(false);
  const [reminderEditId, setReminderEditId] = useState<string | null>(null);
  const [reminderEditTitle, setReminderEditTitle] = useState("");
  const [reminderDeleteConfirm, setReminderDeleteConfirm] = useState<{ id: string; title: string; isMonthly: boolean } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState<Priority>("medium");
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activePartners, setActivePartners] = useState<ActiveShare[]>([]);
  const [partnerProfiles, setPartnerProfiles] = useState<Record<string, { username: string; avatar_seed: string | null }>>({});
  const [newPartnerInput, setNewPartnerInput] = useState("");
  const [addPartnerLoading, setAddPartnerLoading] = useState(false);
  const [addPartnerError, setAddPartnerError] = useState<string | null>(null);
  const [receivedInvitations, setReceivedInvitations] = useState<ReceivedInvitation[]>([]);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showRenameCalendarModal, setShowRenameCalendarModal] = useState(false);
  const [renameCalendarValue, setRenameCalendarValue] = useState("");
  const [renameCalendarLoading, setRenameCalendarLoading] = useState(false);
  const [renameCalendarError, setRenameCalendarError] = useState<string | null>(null);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [showUsernameEditModal, setShowUsernameEditModal] = useState(false);
  const [usernameEditValue, setUsernameEditValue] = useState("");
  const [usernameEditLoading, setUsernameEditLoading] = useState(false);
  const [usernameEditError, setUsernameEditError] = useState<string | null>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const notifiedReminderRef = useRef<Set<string>>(new Set());
  const todosRef = useRef<Todo[]>([]);
  const profileRef = useRef(profile);
  const activePartnerUsernamesRef = useRef<string[]>([]);
  const sessionRef = useRef(session);
  const calendarsAutoRetryCountRef = useRef(0);
  const calendarsRetryCountRef = useRef(0);
  const calendarsAutoCreateAttemptedRef = useRef(false);
  const runFetchCalendarsWithTimeoutRef = useRef<() => void>(() => {});
  todosRef.current = todos;
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

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setShowSettingsDropdown(false);
      }
    };
    if (showSettingsDropdown) {
      document.addEventListener("click", onOutside);
      return () => document.removeEventListener("click", onOutside);
    }
  }, [showSettingsDropdown]);

  const fetchProfile = React.useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("username, avatar_seed")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch profile", error);
      setProfile(null);
    } else {
      setProfile({ username: data?.username ?? null, avatar_seed: data?.avatar_seed ?? null });
    }
    setProfileLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const createDefaultCalendar = React.useCallback(async (): Promise<CalendarItem | null> => {
    if (!session?.user?.id) return null;
    const { data: cal, error: calErr } = await supabase
      .from("calendars")
      .insert({ name: "マイカレンダー（個人用）", created_by: session.user.id })
      .select("id, name, created_by")
      .single();
    if (calErr || !cal) {
      console.error("[createDefaultCalendar] calendars 作成失敗:", calErr?.message, calErr?.code, calErr?.details);
      return null;
    }
    // calendar_members は RLS 自己完結のため、user_id のみ指定した単純な insert
    const { error: memberErr } = await supabase.from("calendar_members").insert({
      calendar_id: cal.id,
      user_id: session.user.id,
      role: "owner",
      status: "active",
    });
    if (memberErr) {
      console.error("[createDefaultCalendar] calendar_members 登録失敗:", memberErr.message, memberErr.code, memberErr.details);
      return null;
    }
    return { id: cal.id, name: cal.name, created_by: cal.created_by };
  }, [session?.user?.id]);

  const fetchCalendars = React.useCallback(async () => {
    if (!session?.user?.id) return;
    const myId = session.user.id;
    setCalendarsEmptyPrompt(null);

    const { data: memberRows, error } = await supabase
      .from("calendar_members")
      .select("*, calendars(id, name, created_by)")
      .eq("user_id", myId)
      .eq("status", "active");

    if (error) {
      console.error("[fetchCalendars] 取得失敗:", error.message, error.code, error.details);
      setCalendarsAutoCreating(true);
      const fallback = await createDefaultCalendar();
      setCalendarsAutoCreating(false);
      if (fallback) {
        setCalendarsList([fallback]);
        setCurrentCalendarId(fallback.id);
      } else {
        setCalendarsList([]);
      }
      setCalendarsReconnecting(false);
      setCalendarsEmptyPrompt(null);
      return;
    }

    type Row = { calendar_id: string; calendars: { id: string; name: string; created_by: string } | null };
    const rows = (memberRows || []) as Row[];
    const seen = new Set<string>();
    const list: CalendarItem[] = [];
    for (const r of rows) {
      const c = r.calendars;
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        list.push({ id: c.id, name: c.name, created_by: c.created_by });
      }
    }

    if (list.length === 0) {
      setCalendarsAutoCreating(true);
      const created = await createDefaultCalendar();
      setCalendarsAutoCreating(false);
      if (created) {
        setCalendarsList([created]);
        setCurrentCalendarId(created.id);
      } else {
        setCalendarsList([]);
      }
      setCalendarsReconnecting(false);
      setCalendarsEmptyPrompt(null);
      return;
    }

    const defaultCalendarId = list.find((c) => c.name === "マイカレンダー（個人用）")?.id ?? list[0]?.id;
    setCalendarsList(list);
    setCurrentCalendarId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      return defaultCalendarId ?? null;
    });
    setCalendarsReconnecting(false);
    setCalendarsEmptyPrompt(null);
    calendarsAutoRetryCountRef.current = 0;
    calendarsRetryCountRef.current = 0;
  }, [session?.user?.id, createDefaultCalendar]);

  const runFetchCalendarsWithTimeout = React.useCallback(() => {
    if (!session?.user?.id) return;
    setCalendarsEmptyPrompt(null);
    setCalendarsLoading(true);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000));
    Promise.race([fetchCalendars(), timeout])
      .then(() => setCalendarsReconnecting(false))
      .catch(() => setCalendarsReconnecting(false))
      .finally(() => setCalendarsLoading(false));
  }, [session?.user?.id, fetchCalendars]);
  runFetchCalendarsWithTimeoutRef.current = runFetchCalendarsWithTimeout;

  useEffect(() => {
    if (!session?.user?.id) {
      setCalendarsLoading(false);
      setCalendarsReconnecting(false);
      setCalendarsEmptyPrompt(null);
      setCalendarsAutoCreating(false);
      calendarsAutoCreateAttemptedRef.current = false;
      calendarsRetryCountRef.current = 0;
      return;
    }
    calendarsRetryCountRef.current = 0;
    runFetchCalendarsWithTimeout();
  }, [session?.user?.id, runFetchCalendarsWithTimeout]);

  const fetchCalendarMembers = React.useCallback(
    async (calendarId: string | null) => {
      if (!session?.user?.id) return;
      if (!calendarId) {
        setPendingRequests([]);
        setActivePartners([]);
        setPartnerProfiles({});
        return;
      }
      const myId = session.user.id;
      const { data: pendingRows, error: pendingErr } = await supabase
        .from("calendar_members")
        .select("id, invited_by")
        .eq("calendar_id", calendarId)
        .eq("user_id", myId)
        .eq("status", "pending");
      if (pendingErr) console.error("Failed to fetch pending calendar_members", pendingErr);
      const inviterIds = (pendingRows || []).map((r: { invited_by: string | null }) => r.invited_by).filter(Boolean) as string[];
      const pendingWithNames: PendingRequest[] = [];
      if (inviterIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", inviterIds);
        const nameById = new Map((profiles || []).map((p: { id: string; username: string | null }) => [p.id, p.username ?? "?"]));
        pendingRows?.forEach((r: { id: string; invited_by: string | null }) => {
          pendingWithNames.push({ id: r.id, applicant_username: nameById.get(r.invited_by ?? "") ?? "?" });
        });
      }
      setPendingRequests(pendingWithNames);

      const { data: memberRows, error: memberErr } = await supabase
        .from("calendar_members")
        .select("id, user_id")
        .eq("calendar_id", calendarId)
        .eq("status", "active")
        .neq("user_id", myId);
      if (memberErr) {
        console.error("Failed to fetch calendar members", memberErr);
        setActivePartners([]);
        setPartnerProfiles({});
        return;
      }
      const partnerIds = (memberRows || []).map((r: { user_id: string }) => r.user_id);
      const activeWithNames: ActiveShare[] = [];
      const nextPartnerProfiles: Record<string, { username: string; avatar_seed: string | null }> = {};
      if (partnerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id,username,avatar_seed").in("id", partnerIds);
        const nameById = new Map((profiles || []).map((p: { id: string; username: string | null }) => [p.id, p.username ?? "?"]));
        (profiles || []).forEach((p: { id: string; username: string | null; avatar_seed: string | null }) => {
          nextPartnerProfiles[p.id] = { username: p.username ?? "", avatar_seed: p.avatar_seed ?? null };
        });
        memberRows?.forEach((r: { id: string; user_id: string }) => {
          activeWithNames.push({ id: r.id, partner_user_id: r.user_id, partner_username: nameById.get(r.user_id) ?? "?" });
        });
      }
      setActivePartners(activeWithNames);
      setPartnerProfiles(nextPartnerProfiles);
    },
    [session?.user?.id]
  );

  useEffect(() => {
    fetchCalendarMembers(currentCalendarId);
  }, [currentCalendarId, fetchCalendarMembers]);

  const fetchReceivedInvitations = React.useCallback(async () => {
    if (!session?.user?.id) return;
    const { data: rows, error } = await supabase
      .from("calendar_members")
      .select("id, calendar_id, invited_by")
      .eq("user_id", session.user.id)
      .eq("status", "pending");
    if (error) {
      console.error("Failed to fetch received invitations", error);
      setReceivedInvitations([]);
      return;
    }
    if (!rows?.length) {
      setReceivedInvitations([]);
      return;
    }
    const calendarIds = [...new Set((rows as { calendar_id: string }[]).map((r) => r.calendar_id))];
    const inviterIds = [...new Set((rows as { invited_by: string | null }[]).map((r) => r.invited_by).filter(Boolean))] as string[];
    const [calRes, profileRes] = await Promise.all([
      supabase.from("calendars").select("id, name").in("id", calendarIds),
      inviterIds.length > 0 ? supabase.from("profiles").select("id, username").in("id", inviterIds) : { data: [] },
    ]);
    const calendarNameById = new Map((calRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const usernameById = new Map((profileRes.data || []).map((p: { id: string; username: string | null }) => [p.id, p.username ?? "?"]));
    const list: ReceivedInvitation[] = (rows as { id: string; calendar_id: string; invited_by: string | null }[]).map((r) => ({
      id: r.id,
      calendar_id: r.calendar_id,
      calendar_name: calendarNameById.get(r.calendar_id) ?? "（不明）",
      invited_by_username: usernameById.get(r.invited_by ?? "") ?? "?",
    }));
    setReceivedInvitations(list);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchReceivedInvitations();
  }, [fetchReceivedInvitations]);

  useEffect(() => {
    if (currentCalendarId) setAddPartnerError(null);
  }, [currentCalendarId]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchTodos();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((p) => setNotificationPermission(p));
    }
    const t = setInterval(() => {
      checkAndNotifyOverdue();
      checkAndNotifyReminders();
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session || !currentCalendarId) return;
    fetchTodos();
  }, [session, currentCalendarId, activePartners]);

  const fetchNotifications = React.useCallback(async () => {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id,message,created_at,is_read")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to fetch notifications", error);
      return;
    }
    setNotifications(
      (data || []).map((r: { id: string; message: string; created_at: string; is_read: boolean }) => ({
        id: r.id,
        message: r.message,
        created_at: r.created_at,
        is_read: r.is_read,
      }))
    );
  }, [session?.user?.id]);

  const markNotificationsRead = React.useCallback(async () => {
    if (!session?.user?.id) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", session.user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [session?.user?.id]);

  const insertNotificationLog = React.useCallback(
    async (message: string) => {
      if (!session?.user?.id) return;
      const userIds = [session.user.id, ...activePartners.map((p) => p.partner_user_id)];
      const rows = userIds.map((user_id) => ({ user_id, message }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) console.error("Failed to insert notifications", error);
    },
    [session?.user?.id, activePartners]
  );

  useEffect(() => {
    if (showNotifications && session?.user?.id) {
      fetchNotifications().then(() => markNotificationsRead());
    }
  }, [showNotifications, session?.user?.id, fetchNotifications, markNotificationsRead]);

  useEffect(() => {
    if (!session || !currentCalendarId) return;
    const channel = supabase
      .channel(`todos-changes-${currentCalendarId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "todos",
          filter: `calendar_id=eq.${currentCalendarId}`,
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const myUsername = profileRef.current?.username?.trim();
          const newRow = payload.new as { title?: string; completed?: boolean; created_by_username?: string | null; user_id?: string; priority?: Priority; calendar_id?: string } | null;
          const oldRow = payload.old as { title?: string; completed?: boolean; created_by_username?: string | null; priority?: Priority } | null;
          const who = (newRow?.created_by_username || oldRow?.created_by_username || "").trim() || "誰か";
          const isFromMe = who === myUsername;
          const partners = activePartnerUsernamesRef.current;
          const isFromPartner = who && who !== myUsername && partners.includes(who);
          const priorityLabel = (p: string | undefined) => (p === "high" || p === "medium" || p === "low" ? PRIORITY_LABEL[p] : "中");
          if (isFromMe) {
            fetchTodosRef.current();
            return;
          }
          if (payload.eventType === "INSERT" && newRow?.title && isFromPartner) {
            addToast(`${who}さんが『${priorityLabel(newRow.priority)}』優先度のタスク「${newRow.title}」を追加しました`);
          } else if (payload.eventType === "UPDATE" && newRow && oldRow) {
            const becameCompleted = newRow.completed === true && oldRow.completed !== true;
            const uncompleted = newRow.completed === false && oldRow.completed === true;
            if (newRow.title && isFromPartner) {
              if (becameCompleted) addToast(`${who}さんがタスク「${newRow.title}」を完了しました`);
              else if (uncompleted) addToast(`${who}さんがタスク「${newRow.title}」の完了を解除しました`);
            }
          }
          fetchTodosRef.current();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentCalendarId, addToast]);

  const activePartnerIdsRef = useRef<Set<string>>(new Set());
  activePartnerIdsRef.current = new Set(activePartners.map((p) => p.partner_user_id));

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload: { new: { id: string; username?: string | null; avatar_seed?: string | null } }) => {
          const id = payload.new?.id;
          if (!id) return;
          if (id === session.user.id) {
            fetchProfile();
            return;
          }
          if (activePartnerIdsRef.current.has(id)) {
            setPartnerProfiles((prev) => ({
              ...prev,
              [id]: {
                username: payload.new?.username ?? prev[id]?.username ?? "",
                avatar_seed: payload.new?.avatar_seed ?? null,
              },
            }));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchProfile]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`calendar_members-invites-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calendar_members",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload: { eventType: string; new: { status?: string } | null }) => {
          fetchReceivedInvitations();
          if (payload.eventType === "UPDATE" && payload.new?.status === "active") {
            fetchCalendars();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchReceivedInvitations, fetchCalendars]);

  const fetchTodosRef = useRef<() => Promise<void>>(async () => {});

  async function fetchTodos() {
    if (!session?.user?.id || !currentCalendarId) {
      setTodos([]);
      return;
    }
    const { data, error } = await supabase
      .from("todos")
      .select("id,title,completed,date,created_by_username,priority,position,user_id,reminder_time,reminder_date,is_monthly_recurring")
      .eq("calendar_id", currentCalendarId)
      .order("date", { ascending: true });
    if (error) {
      console.error("Failed to fetch todos", error);
      alert("予定の取得に失敗しました: " + (error.message || JSON.stringify(error)));
      setTodos([]);
      return;
    }
    const mapped: Todo[] = (data || []).map((r: any) => ({
      id: String(r.id),
      text: r.title,
      completed: r.completed,
      date: new Date(r.date),
      createdByUsername: r.created_by_username ?? null,
      priority: (r.priority === "high" || r.priority === "medium" || r.priority === "low" ? r.priority : "medium") as Priority,
      position: typeof r.position === "number" ? r.position : 0,
      userId: r.user_id ?? undefined,
      reminderTime: r.reminder_time != null ? String(r.reminder_time).slice(0, 5) : null,
      reminderDate: r.reminder_date ?? null,
      isMonthlyRecurring: Boolean(r.is_monthly_recurring),
    }));
    setTodos(mapped);
  }
  fetchTodosRef.current = fetchTodos;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCalendarId) {
      setAddPartnerError("カレンダーを選択してください");
      return;
    }
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
    const { error } = await supabase.from("calendar_members").insert({
      calendar_id: currentCalendarId,
      user_id: profileRow.id,
      role: "member",
      status: "pending",
      invited_by: session!.user.id,
    });
    setAddPartnerLoading(false);
    if (error) {
      if (error.code === "23505") setAddPartnerError("既に申請済みか、共有済みです");
      else setAddPartnerError(error.message);
      return;
    }
    setNewPartnerInput("");
    addToast("共有申請を送りました");
    fetchCalendarMembers(currentCalendarId);
  };

  const handleApprove = async (memberId: string) => {
    const { error } = await supabase
      .from("calendar_members")
      .update({ status: "active" })
      .eq("id", memberId)
      .eq("user_id", session!.user.id);
    if (error) {
      console.error("Approve error", error);
      addToast("承認に失敗しました");
      return;
    }
    addToast("共有を承認しました");
    fetchCalendarMembers(currentCalendarId).then(() => fetchTodos());
  };

  const handleReject = async (memberId: string) => {
    const { error } = await supabase.from("calendar_members").delete().eq("id", memberId).eq("user_id", session!.user.id);
    if (error) {
      console.error("Reject error", error);
      addToast("拒否に失敗しました");
      return;
    }
    addToast("申請を拒否しました");
    fetchCalendarMembers(currentCalendarId);
  };

  const handleApproveReceivedInvitation = async (invitation: ReceivedInvitation) => {
    const { error } = await supabase
      .from("calendar_members")
      .update({ status: "active" })
      .eq("id", invitation.id)
      .eq("user_id", session!.user.id);
    if (error) {
      console.error("Approve invitation error", error);
      addToast("承認に失敗しました");
      return;
    }
    addToast(`${invitation.calendar_name} に参加しました`);
    await fetchCalendars();
    fetchReceivedInvitations();
    setCurrentCalendarId(invitation.calendar_id);
  };

  const handleRejectReceivedInvitation = async (invitationId: string) => {
    const { error } = await supabase.from("calendar_members").delete().eq("id", invitationId).eq("user_id", session!.user.id);
    if (error) {
      console.error("Reject invitation error", error);
      addToast("拒否に失敗しました");
      return;
    }
    addToast("招待を拒否しました");
    fetchReceivedInvitations();
  };

  const handleUnshare = async (memberId: string) => {
    const { error } = await supabase.from("calendar_members").delete().eq("id", memberId);
    if (error) {
      console.error("Unshare error", error);
      addToast("解除に失敗しました");
      return;
    }
    addToast("共有を解除しました");
    fetchCalendarMembers(currentCalendarId).then(() => fetchTodos());
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

  function checkAndNotifyReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    todosRef.current.forEach((t) => {
      if (t.completed) return;
      const hasTime = t.reminderTime != null && t.reminderTime !== "";
      const hasDate = t.reminderDate != null && t.reminderDate !== "";
      if (!hasTime && !hasDate) return;
      let notifyAt: Date;
      if (hasTime) {
        const [h, m] = t.reminderTime!.split(":").map(Number);
        const d = t.date;
        notifyAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m ?? 0, 0);
      } else {
        notifyAt = new Date(t.reminderDate! + "T09:00:00");
      }
      const key = `${t.id}-${format(notifyAt, "yyyy-MM-dd")}`;
      if (now >= notifyAt && !notifiedReminderRef.current.has(key)) {
        new Notification("リマインド: " + t.text, { body: format(notifyAt, "M月d日 H:mm") + " のタスク" });
        notifiedReminderRef.current.add(key);
      }
    });
  }

  const selectedDateTodos = useMemo(() => {
    const list = todos.filter((t) => isSameDay(t.date, selectedDate));
    return [...list].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.position - b.position
    );
  }, [todos, selectedDate]);

  const reminderTodos = useMemo(() => {
    const hasReminder = (t: Todo) =>
      (t.reminderTime != null && t.reminderTime !== "") ||
      (t.reminderDate != null && t.reminderDate !== "") ||
      t.isMonthlyRecurring;
    const withReminder = todos.filter(hasReminder);
    const monthlyByTitle = new Map<string, Todo>();
    const nonMonthly: Todo[] = [];
    for (const t of withReminder) {
      if (t.isMonthlyRecurring) {
        const existing = monthlyByTitle.get(t.text);
        if (!existing || t.date >= existing.date) monthlyByTitle.set(t.text, t);
      } else {
        nonMonthly.push(t);
      }
    }
    return [...Array.from(monthlyByTitle.values()), ...nonMonthly].sort(
      (a, b) => a.text.localeCompare(b.text) || new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [todos]);

  const todosByDate = useMemo(() => {
    const map = new Map<string, number>();
    todos.forEach((todo) => {
      const key = format(todo.date, "yyyy-MM-dd");
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [todos]);

  const weeklyReport = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const completed = todos.filter((t) => {
      const d = new Date(t.date);
      d.setHours(0, 0, 0, 0);
      return t.completed && d >= weekStart && d <= weekEnd;
    });
    const total = completed.length;
    const byPriority = { high: 0, medium: 0, low: 0 } as Record<Priority, number>;
    completed.forEach((t) => {
      byPriority[t.priority]++;
    });
    const byDate: Record<string, Record<string, Todo[]>> = {};
    completed.forEach((t) => {
      const key = format(t.date, "yyyy-MM-dd");
      if (!byDate[key]) byDate[key] = {};
      const user = t.createdByUsername?.trim() || "自分";
      if (!byDate[key][user]) byDate[key][user] = [];
      byDate[key][user].push(t);
    });
    const sortedDates = Object.keys(byDate).sort();
    return { total, byPriority, byDate, sortedDates };
  }, [todos]);

  const copyReportText = React.useCallback(() => {
    const lines: string[] = ["【今週の成果報告】", ""];
    lines.push(`合計完了数: ${weeklyReport.total}件 (高: ${weeklyReport.byPriority.high} / 中: ${weeklyReport.byPriority.medium} / 低: ${weeklyReport.byPriority.low})`);
    const weekDay = ["日", "月", "火", "水", "木", "金", "土"];
    weeklyReport.sortedDates.forEach((dateKey) => {
      const date = new Date(dateKey + "T12:00:00");
      const dayLabel = weekDay[date.getDay()];
      lines.push("", `■ ${format(date, "M/d")}(${dayLabel})`, "");
      const byUser = weeklyReport.byDate[dateKey];
      Object.entries(byUser).forEach(([user, tasks]) => {
        if (user !== "自分") lines.push(`${user}さんの成果`);
        tasks.forEach((t) => lines.push(t.text));
        if (user !== "自分") lines.push("");
      });
    });
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => addToast("報告用テキストをコピーしました"), () => addToast("コピーに失敗しました"));
  }, [weeklyReport, addToast]);

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

  // このカレンダーを共有している参加メンバー全員（自分＋パートナー）。DBの最新プロフィールで表示用に利用
  const calendarMembers = useMemo(() => {
    const self = session?.user?.id && profile
      ? { id: session.user.id, username: profile.username?.trim() ?? "", avatar_seed: profile.avatar_seed ?? null }
      : null;
    const partners = activePartners.map((p) => ({
      id: p.partner_user_id,
      username: (partnerProfiles[p.partner_user_id]?.username ?? p.partner_username)?.trim() ?? "",
      avatar_seed: partnerProfiles[p.partner_user_id]?.avatar_seed ?? null,
    }));
    const list = self ? [self, ...partners] : partners;
    return list;
  }, [session?.user?.id, profile, activePartners, partnerProfiles]);

  const handleSubmit = async () => {
    if (!session?.user?.id || !profile?.username?.trim()) {
      console.error("handleSubmit: not logged in or username missing");
      return;
    }
    if (newTodoText.trim() === "") {
      console.error("handleSubmit: newTodoText is empty");
      return;
    }
    if (!currentCalendarId) {
      addToast("カレンダーを選択してください");
      return;
    }
    const title = newTodoText.trim();
    const date = format(selectedDate, "yyyy-MM-dd");
    try {
      const { data, error } = await supabase
        .from("todos")
        .insert([
          {
            title,
            date,
            calendar_id: currentCalendarId,
            user_id: session.user.id,
            created_by_username: profile.username.trim(),
            priority: newTodoPriority,
            position: 0,
          },
        ])
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
        const actor = profile?.username?.trim() || "自分";
        await insertNotificationLog(`${actor}がタスク「${title}」を追加しました`);
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
      setNewTodoPriority("medium");
    }
  };

  const handleChangePriority = async (id: string, priority: Priority) => {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const { error } = await supabase.from("todos").update({ priority }).eq("id", id);
    if (error) {
      console.error("update priority error", error);
      return;
    }
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, priority } : t)));
    const actor = profile?.username?.trim() || "自分";
    await insertNotificationLog(`${actor}がタスク「${target.text}」の優先度を${PRIORITY_LABEL[priority]}に変更しました`);
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
    const actor = profile?.username?.trim() || "自分";
    const msg = newCompleted
      ? `${actor}がタスク「${target.text}」を完了しました`
      : `${actor}がタスク「${target.text}」の完了を解除しました`;
    await insertNotificationLog(msg);

    if (newCompleted && target.isMonthlyRecurring && currentCalendarId && session?.user?.id) {
      const nextMonthDate = addMonths(target.date, 1);
      const isLastDay = isSameDay(target.date, endOfMonth(target.date));
      const nextDateStr = format(isLastDay ? endOfMonth(nextMonthDate) : nextMonthDate, "yyyy-MM-dd");
      const reminderTimeVal = target.reminderTime ? `${target.reminderTime}:00` : null;
      const nextUserId = target.userId ?? session.user.id;
      await supabase.from("todos").insert([
        {
          title: target.text,
          date: nextDateStr,
          calendar_id: currentCalendarId,
          user_id: nextUserId,
          created_by_username: profile?.username?.trim() ?? "",
          priority: target.priority,
          position: 0,
          is_monthly_recurring: true,
          reminder_time: reminderTimeVal,
          reminder_date: target.reminderDate ?? nextDateStr,
        },
      ]);
      fetchTodos();
    }
  };

  const handleDeleteTodo = async (id: string) => {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      console.error("delete error", error);
      return;
    }
    setTodos((prev) => prev.filter((t) => t.id !== id));
    const actor = profile?.username?.trim() || "自分";
    await insertNotificationLog(`${actor}がタスク「${target.text}」を削除しました`);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selectedDateTodos.findIndex((t) => t.id === active.id);
    const newIndex = selectedDateTodos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(selectedDateTodos, oldIndex, newIndex);
    const reordered = newOrder.map((t, i) => ({ ...t, position: i }));
    setTodos((prev) => {
      const others = prev.filter((t) => !isSameDay(t.date, selectedDate));
      return [...others, ...reordered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    const myUpdates = reordered.filter((t) => t.userId === session?.user?.id);
    await Promise.all(myUpdates.map((t) => supabase.from("todos").update({ position: t.position }).eq("id", t.id)));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  const openReminderModal = () => {
    setReminderTitle("");
    setReminderMode("date");
    setReminderTime("09:00");
    setReminderDate(format(selectedDate, "yyyy-MM-dd"));
    setReminderMonthly(false);
    setReminderDayOfMonth(selectedDate.getDate());
    setShowReminderModal(true);
  };

  function getNextOccurrenceOfDay(dayOfMonth: number, fromDate: Date): Date {
    const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    if (dayOfMonth <= 0) {
      const endThis = endOfMonth(from);
      if (endThis > from) return endThis;
      return endOfMonth(addMonths(from, 1));
    }
    const lastDay = endOfMonth(from).getDate();
    const day = Math.min(dayOfMonth, lastDay);
    let next = new Date(from.getFullYear(), from.getMonth(), day);
    if (next <= from) {
      next = addMonths(next, 1);
      next = new Date(next.getFullYear(), next.getMonth(), Math.min(dayOfMonth, endOfMonth(next).getDate()));
    }
    return next;
  }

  const handleSubmitReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = reminderTitle.trim();
    if (!title) return;
    if (!session?.user?.id || !currentCalendarId) {
      addToast("カレンダーを選択してください");
      return;
    }
    setReminderSubmitting(true);
    const now = new Date();
    const reminderTimeVal = reminderMode === "time" ? `${reminderTime}:00` : null;

    const rowsToInsert: Record<string, unknown>[] = [];
    if (reminderMonthly) {
      const firstDate = getNextOccurrenceOfDay(reminderDayOfMonth, now);
      const isLastDayOfMonth = reminderDayOfMonth <= 0 || firstDate.getDate() === endOfMonth(firstDate).getDate();
      const dateStr = format(isLastDayOfMonth ? endOfMonth(firstDate) : firstDate, "yyyy-MM-dd");
      rowsToInsert.push({
        title,
        date: dateStr,
        calendar_id: currentCalendarId,
        user_id: session.user.id,
        created_by_username: profile?.username?.trim() ?? "",
        priority: newTodoPriority,
        position: 0,
        is_monthly_recurring: true,
        reminder_time: reminderTimeVal,
        reminder_date: dateStr,
      });
    } else {
      const taskDateStr = reminderMode === "date" ? reminderDate : format(selectedDate, "yyyy-MM-dd");
      const reminderDateVal = reminderMode === "date" ? (reminderDate || taskDateStr) : taskDateStr;
      rowsToInsert.push({
        title,
        date: taskDateStr,
        calendar_id: currentCalendarId,
        user_id: session.user.id,
        created_by_username: profile?.username?.trim() ?? "",
        priority: newTodoPriority,
        position: 0,
        is_monthly_recurring: false,
        reminder_time: reminderTimeVal,
        reminder_date: reminderDateVal,
      });
    }

    const { error } = await supabase.from("todos").insert(rowsToInsert).select();
    setReminderSubmitting(false);
    if (error) {
      console.error("Reminder todo insert error", error);
      addToast("リマインドの追加に失敗しました");
      return;
    }
    setShowReminderModal(false);
    fetchTodos();
    addToast("リマインドを設定しました");
  };

  const setReminderDateToFirst = () => {
    setReminderDate(format(startOfMonth(selectedDate), "yyyy-MM-dd"));
  };
  const setReminderDateToLast = () => {
    setReminderDate(format(endOfMonth(selectedDate), "yyyy-MM-dd"));
  };

  const handleReminderEditSave = async () => {
    if (!reminderEditId || !reminderEditTitle.trim()) {
      setReminderEditId(null);
      return;
    }
    const { error } = await supabase.from("todos").update({ title: reminderEditTitle.trim() }).eq("id", reminderEditId);
    if (error) {
      console.error("Reminder title update error", error);
      addToast("名前の変更に失敗しました");
      return;
    }
    setReminderEditId(null);
    setReminderEditTitle("");
    fetchTodos();
    addToast("名前を変更しました");
  };

  const handleReminderDelete = async (mode: "single" | "all", optionalId?: string) => {
    const target = reminderDeleteConfirm;
    const idToDelete = optionalId ?? target?.id;
    if (!idToDelete || !currentCalendarId) return;
    setReminderDeleteConfirm(null);
    if (mode === "single") {
      const { error } = await supabase.from("todos").delete().eq("id", idToDelete);
      if (error) {
        console.error("Delete todo error", error);
        addToast("削除に失敗しました");
        return;
      }
      addToast("1件削除しました");
    } else {
      const todo = todos.find((t) => t.id === target!.id);
      if (!todo) return;
      const { data: rows } = await supabase
        .from("todos")
        .select("id")
        .eq("calendar_id", currentCalendarId)
        .eq("title", todo.text)
        .eq("is_monthly_recurring", true);
      const ids = (rows || []).map((r: { id: string }) => r.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("todos").delete().in("id", ids);
      if (error) {
        console.error("Bulk delete error", error);
        addToast("一括削除に失敗しました");
        return;
      }
      addToast(`この作業のリマインドを${ids.length}件削除しました`);
    }
    fetchTodos();
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = usernameEditValue.trim();
    const err = validateUsername(trimmed);
    if (err) {
      setUsernameEditError(err);
      return;
    }
    if (!session?.user?.id) return;
    const currentUsername = (profile?.username ?? "").trim();
    if (trimmed === currentUsername) {
      setShowUsernameEditModal(false);
      setUsernameEditValue("");
      setUsernameEditError(null);
      setShowSettingsDropdown(false);
      addToast("変更がありません");
      return;
    }
    setUsernameEditError(null);
    setUsernameEditLoading(true);
    const { error } = await supabase.from("profiles").update({ username: trimmed }).eq("id", session.user.id);
    if (error) {
      console.error("Failed to update username", error);
      const isDuplicate = error.code === "23505" || /duplicate|unique/i.test(error.message ?? "");
      const message = isDuplicate
        ? "このユーザー名は既に使われています。別の名前を入力してください"
        : (error.message ?? "変更に失敗しました");
      setUsernameEditError(message);
      if (isDuplicate) addToast(message);
      setUsernameEditLoading(false);
      return;
    }
    await fetchProfile();
    setShowUsernameEditModal(false);
    setUsernameEditValue("");
    setUsernameEditLoading(false);
    setShowSettingsDropdown(false);
    addToast("ユーザー名を変更しました");
  };

  const handleRenameCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = renameCalendarValue.trim();
    if (!name) {
      setRenameCalendarError("名前を入力してください");
      return;
    }
    if (name.length > 100) {
      setRenameCalendarError("カレンダー名は100文字以内にしてください");
      return;
    }
    if (!currentCalendarId || !session?.user?.id) return;
    setRenameCalendarError(null);
    setRenameCalendarLoading(true);
    const { error } = await supabase.from("calendars").update({ name }).eq("id", currentCalendarId).eq("created_by", session.user.id);
    if (error) {
      console.error("Failed to rename calendar", error);
      setRenameCalendarError(error.message ?? "名前の変更に失敗しました");
      setRenameCalendarLoading(false);
      return;
    }
    setCalendarsList((prev) => prev.map((c) => (c.id === currentCalendarId ? { ...c, name } : c)));
    setShowRenameCalendarModal(false);
    setRenameCalendarValue("");
    setRenameCalendarLoading(false);
    setShowSettingsDropdown(false);
    addToast("カレンダー名を変更しました");
  };

  const handleDeleteAccount = async () => {
    if (!session?.user?.id) return;
    setDeleteAccountLoading(true);
    try {
      const uid = session.user.id;
      const { error: todosErr } = await supabase.from("todos").delete().eq("user_id", uid);
      if (todosErr) {
        console.error("Failed to delete todos", todosErr);
        addToast("データの削除に失敗しました");
        setDeleteAccountLoading(false);
        return;
      }
      const { error: membersErr } = await supabase.from("calendar_members").delete().eq("user_id", uid);
      if (membersErr) {
        console.error("Failed to delete calendar_members", membersErr);
        addToast("データの削除に失敗しました");
        setDeleteAccountLoading(false);
        return;
      }
      const { data: myCalendars } = await supabase.from("calendars").select("id").eq("created_by", uid);
      if (myCalendars?.length) {
        for (const cal of myCalendars) {
          await supabase.from("calendars").delete().eq("id", cal.id);
        }
      }
      const { error: profileErr } = await supabase.from("profiles").delete().eq("id", uid);
      if (profileErr) {
        console.error("Failed to delete profile", profileErr);
        addToast("データの削除に失敗しました");
        setDeleteAccountLoading(false);
        return;
      }
      setShowDeleteAccountConfirm(false);
      setShowSettingsDropdown(false);
      await supabase.auth.signOut();
      addToast("アカウントを削除しました");
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const handleLogout = async () => {
    setShowSettingsDropdown(false);
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
  const avatarSeed = (profile?.avatar_seed?.trim() || profile?.username?.trim() || "default") as string;

  function getAvatarSeedForUsername(username: string): string {
    const name = username?.trim();
    if (!name) return "自分";
    if (name === displayName) return avatarSeed;
    const partner = activePartners.find((p) => p.partner_username === name);
    if (partner) return (partnerProfiles[partner.partner_user_id]?.avatar_seed ?? partner.partner_username).trim() || partner.partner_username;
    return name;
  }

  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCalendarName.trim();
    if (!name) {
      setCreateCalendarError("カレンダー名を入力してください");
      return;
    }
    if (name.length > 100) {
      setCreateCalendarError("カレンダー名は100文字以内にしてください");
      return;
    }
    if (!session?.user?.id) return;
    setCreateCalendarError(null);
    setCreateCalendarLoading(true);
    const { data: cal, error: calErr } = await supabase
      .from("calendars")
      .insert({ name, created_by: session.user.id })
      .select("id, name, created_by")
      .single();
    if (calErr || !cal) {
      console.error("Failed to create calendar", calErr);
      setCreateCalendarError(calErr?.message ?? "カレンダーの作成に失敗しました");
      setCreateCalendarLoading(false);
      return;
    }
    // calendar_members は RLS 自己完結のため、user_id のみ指定した単純な insert
    const { error: memberErr } = await supabase.from("calendar_members").insert({
      calendar_id: cal.id,
      user_id: session.user.id,
      role: "owner",
      status: "active",
    });
    if (memberErr) {
      console.error("Failed to add owner to new calendar", memberErr);
      setCreateCalendarError("カレンダーの設定に失敗しました");
      setCreateCalendarLoading(false);
      return;
    }
    const newItem: CalendarItem = { id: cal.id, name: cal.name, created_by: cal.created_by };
    setCalendarsList((prev) => [...prev, newItem]);
    setCurrentCalendarId(cal.id);
    setNewCalendarName("");
    setShowCreateCalendarModal(false);
    setCreateCalendarLoading(false);
    addToast("カレンダーを作成しました");
  };

  const handleRandomAvatar = async () => {
    if (!session?.user?.id) return;
    const seed = crypto.randomUUID();
    const { error } = await supabase.from("profiles").update({ avatar_seed: seed }).eq("id", session.user.id);
    if (error) {
      console.error("Failed to update avatar_seed", error);
      addToast("アバターの更新に失敗しました");
      return;
    }
    await fetchProfile();
    await fetchTodos();
    addToast("アバターを更新しました");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 relative">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold shrink-0">カレンダーTodoリスト</h1>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg text-muted-foreground" aria-hidden>📅</span>
              <select
                value={currentCalendarId ?? ""}
                onChange={(e) => setCurrentCalendarId(e.target.value || null)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium min-w-[180px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="表示するカレンダーを選択"
              >
                {calendarsList.length === 0 ? (
                  <option value="">{calendarsLoading ? "同期中..." : "マイカレンダー（個人用）"}</option>
                ) : (
                  calendarsList.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.name}
                    </option>
                  ))
                )}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateCalendarError(null);
                  setNewCalendarName("");
                  setShowCreateCalendarModal(true);
                }}
                className="shrink-0"
                title="ワークスペースを作成"
              >
                <Plus className="h-4 w-4 mr-1" />
                新規作成
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {calendarMembers.map((member) => {
                const seed = (member.avatar_seed?.trim() || member.username || "default") as string;
                const isSelf = member.id === session?.user?.id;
                return (
                  <div key={member.id} className="flex items-center gap-2">
                    <Avatar seed={seed} size={32} />
                    <span className="text-sm text-muted-foreground">
                      {member.username || "（未設定）"}
                      {isSelf && <span className="ml-1 text-xs">(自分)</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowReminderListModal(true)} title="リマインド一覧">
              <List className="h-4 w-4 mr-1" />
              リマインド一覧
            </Button>
            {typeof window !== "undefined" && "Notification" in window && notificationPermission === "default" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => Notification.requestPermission().then((p) => setNotificationPermission(p))}
              >
                通知を有効にする
              </Button>
            )}
            <div className="relative shrink-0" ref={settingsDropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettingsDropdown((v) => !v)}
                className="flex items-center gap-1.5"
                aria-haspopup="true"
                aria-expanded={showSettingsDropdown}
                aria-label="設定メニュー"
              >
                <Avatar seed={(profile?.avatar_seed?.trim() || profile?.username || "default") as string} size={24} />
                <ChevronDown className={cn("h-4 w-4 transition-transform", showSettingsDropdown && "rotate-180")} />
              </Button>
              {showSettingsDropdown && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-md border bg-card shadow-lg py-1"
                  role="menu"
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground truncate" title={profile?.username ?? "（未設定）"}>
                      {profile?.username?.trim() || "（未設定）"}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setUsernameEditValue(profile?.username?.trim() ?? "");
                        setUsernameEditError(null);
                        setShowUsernameEditModal(true);
                        setShowSettingsDropdown(false);
                      }}
                      title="ユーザー名を変更"
                      aria-label="ユーザー名を変更"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    onClick={() => {
                      handleRandomAvatar();
                      setShowSettingsDropdown(false);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 shrink-0" />
                    アバターをランダム生成
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left disabled:opacity-50"
                    disabled={!currentCalendarId || calendarsList.length === 0}
                    onClick={() => {
                      const cal = calendarsList.find((c) => c.id === currentCalendarId);
                      setRenameCalendarValue(cal?.name ?? "");
                      setRenameCalendarError(null);
                      setShowRenameCalendarModal(true);
                      setShowSettingsDropdown(false);
                    }}
                  >
                    <Pencil className="h-4 w-4 shrink-0" />
                    カレンダー名変更
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive text-left"
                    onClick={() => {
                      setShowDeleteAccountConfirm(true);
                      setShowSettingsDropdown(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    アカウント削除
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    onClick={() => handleLogout()}
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {calendarsLoading && !currentCalendarId && !calendarsReconnecting && (
          <p className="text-sm text-muted-foreground mb-4">同期中...</p>
        )}
        {calendarsReconnecting && (
          <p className="text-sm text-muted-foreground mb-4">再接続中...</p>
        )}
        {calendarsAutoCreating && (
          <p className="text-sm text-muted-foreground mb-4">初期設定を行っています...</p>
        )}
        {!calendarsLoading && !calendarsReconnecting && !calendarsAutoCreating && calendarsList.length === 0 && (
          <p className="text-sm text-muted-foreground mb-4">ワークスペースを同期中、または未作成です。</p>
        )}
        {receivedInvitations.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="py-3">
              <CardTitle className="text-base">あなたへの招待</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {receivedInvitations.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
                    <span className="text-sm">
                      <span className="font-medium">{inv.calendar_name}</span>
                      <span className="text-muted-foreground"> — {inv.invited_by_username}さんから招待</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" onClick={() => handleApproveReceivedInvitation(inv)}>
                        承認
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleRejectReceivedInvitation(inv.id)}>
                        拒否
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
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
                placeholder="チームメンバーのユーザー名を入力（半角英数字・. _ -）"
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
                      <span className="flex items-center gap-2 text-sm">
                        <Avatar seed={req.applicant_username} size={32} />
                        {req.applicant_username}さんから共有申請
                      </span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" onClick={() => handleApprove(req.id)}>
                          承認する
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleReject(req.id)}>
                          拒否
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {activePartners.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">このワークスペースにチームメンバーを招待します</p>
                <ul className="space-y-1">
                  {activePartners.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded border px-3 py-2">
                      <span className="flex items-center gap-2 text-sm">
                        <Avatar seed={getAvatarSeedForUsername(p.partner_username)} size={32} />
                        {p.partner_username}
                      </span>
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>カレンダー</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setShowNotifications(true)} title="お知らせ">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowWeeklyReport(true)}>
                  <FileText className="h-4 w-4 mr-1" />
                  週の振り返り
                </Button>
              </div>
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
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {calendarMembers.map((member) => {
                  const seed = (member.avatar_seed?.trim() || member.username || "default") as string;
                  const isSelf = member.id === session?.user?.id;
                  return (
                    <span key={member.id} className="flex items-center gap-1.5">
                      <Avatar seed={seed} size={32} />
                      <span>
                        {member.username || "（未設定）"}
                        {isSelf && <span className="ml-1 text-xs">(自分)</span>}
                      </span>
                    </span>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input placeholder="新しいTodoを追加..." value={newTodoText} onChange={(e) => setNewTodoText(e.target.value)} onKeyPress={handleKeyPress} className="flex-1 min-w-[200px]" />
                <div className="flex items-center gap-1" role="group" aria-label="優先度">
                  {(["high", "medium", "low"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTodoPriority(p)}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium transition-colors",
                        newTodoPriority === p
                          ? p === "high"
                            ? "bg-red-500 text-white"
                            : p === "medium"
                              ? "bg-amber-500 text-white"
                              : "bg-slate-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
                <Button onClick={handleSubmit} size="icon" title="追加">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={openReminderModal} className="shrink-0" title="リマインド設定">
                  <Clock className="h-4 w-4 mr-1" />
                  リマインド設定
                </Button>
              </div>
              <div className="space-y-2">
                {selectedDateTodos.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">この日にはTodoがありません</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={selectedDateTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {selectedDateTodos.map((todo) => (
                        <SortableTodoRow
                          key={todo.id}
                          todo={todo}
                          useUsernameColors={useUsernameColors}
                          usernameColorMap={usernameColorMap}
                          getAvatarSeedForUsername={getAvatarSeedForUsername}
                          onToggle={handleToggleTodo}
                          onChangePriority={handleChangePriority}
                          onDelete={handleDeleteTodo}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {showCreateCalendarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !createCalendarLoading && setShowCreateCalendarModal(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg max-w-md w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1">ワークスペースを作成</h2>
            <p className="text-sm text-muted-foreground mb-3">プロジェクト用・チーム共有用のワークスペースです。作成後にメンバーを招待できます。</p>
            <form onSubmit={handleCreateCalendar} className="space-y-3">
              <Input
                type="text"
                placeholder="第1プロジェクト、営業1課 共有用 など"
                value={newCalendarName}
                onChange={(e) => {
                  setNewCalendarName(e.target.value);
                  setCreateCalendarError(null);
                }}
                maxLength={100}
                className="w-full"
                autoFocus
                disabled={createCalendarLoading}
              />
              {createCalendarError && <p className="text-sm text-destructive">{createCalendarError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => !createCalendarLoading && setShowCreateCalendarModal(false)}
                  disabled={createCalendarLoading}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={createCalendarLoading}>
                  {createCalendarLoading ? "作成中..." : "作成する"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showUsernameEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !usernameEditLoading && setShowUsernameEditModal(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg max-w-md w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1">ユーザー名を変更</h2>
            <p className="text-sm text-muted-foreground mb-3">半角英数字と記号（. _ -）が使えます。2〜50文字。</p>
            <form onSubmit={handleSaveUsername} className="space-y-3">
              <Input
                type="text"
                placeholder="ユーザー名"
                value={usernameEditValue}
                onChange={(e) => {
                  setUsernameEditValue(e.target.value);
                  setUsernameEditError(null);
                }}
                maxLength={50}
                className="w-full"
                autoFocus
                disabled={usernameEditLoading}
              />
              {usernameEditError && <p className="text-sm text-destructive">{usernameEditError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => !usernameEditLoading && setShowUsernameEditModal(false)}
                  disabled={usernameEditLoading}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={usernameEditLoading}>
                  {usernameEditLoading ? "保存中..." : "保存する"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showRenameCalendarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !renameCalendarLoading && setShowRenameCalendarModal(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg max-w-md w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1">カレンダー名を変更</h2>
            <p className="text-sm text-muted-foreground mb-3">現在表示中のカレンダー名を編集できます。</p>
            <form onSubmit={handleRenameCalendar} className="space-y-3">
              <Input
                type="text"
                placeholder="カレンダー名"
                value={renameCalendarValue}
                onChange={(e) => {
                  setRenameCalendarValue(e.target.value);
                  setRenameCalendarError(null);
                }}
                maxLength={100}
                className="w-full"
                autoFocus
                disabled={renameCalendarLoading}
              />
              {renameCalendarError && <p className="text-sm text-destructive">{renameCalendarError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => !renameCalendarLoading && setShowRenameCalendarModal(false)}
                  disabled={renameCalendarLoading}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={renameCalendarLoading}>
                  {renameCalendarLoading ? "保存中..." : "保存する"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDeleteAccountConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !deleteAccountLoading && setShowDeleteAccountConfirm(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-destructive mb-1">アカウントを削除しますか？</h2>
            <p className="text-sm text-muted-foreground mb-4">
              データをすべて削除して退会します。この操作は取り消せません。本当に退会しますか？
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => !deleteAccountLoading && setShowDeleteAccountConfirm(false)}
                disabled={deleteAccountLoading}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading}
              >
                {deleteAccountLoading ? "削除中..." : "データをすべて削除して退会する"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showReminderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !reminderSubmitting && setShowReminderModal(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground mb-1">リマインド設定</h2>
            <p className="text-sm text-muted-foreground mb-4">作業名とリマインド方法を指定してください。</p>
            <p className="text-xs text-muted-foreground mb-4">※ 毎月リマインドを設定したタスクは、完了すると翌月の同じ日に新しいタスクが自動で作成されます</p>
            <form onSubmit={handleSubmitReminder} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">作業名</label>
                <Input
                  type="text"
                  placeholder="請求書作成"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  maxLength={200}
                  className="w-full"
                  autoFocus
                  disabled={reminderSubmitting}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="reminder-monthly"
                  checked={reminderMonthly}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setReminderMonthly(checked);
                    if (checked) {
                      const from = reminderDate ? new Date(reminderDate + "T12:00:00") : selectedDate;
                      setReminderDayOfMonth(isSameDay(from, endOfMonth(from)) ? 0 : from.getDate());
                    }
                  }}
                  disabled={reminderSubmitting}
                />
                <label htmlFor="reminder-monthly" className="text-sm text-foreground cursor-pointer">
                  毎月この日にリマインドする
                </label>
              </div>
              {reminderMonthly ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">日（例：25日）</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={reminderDayOfMonth <= 0 ? "last" : reminderDayOfMonth}
                      onChange={(e) => setReminderDayOfMonth(e.target.value === "last" ? 0 : Number(e.target.value))}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[80px]"
                      disabled={reminderSubmitting}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}日
                        </option>
                      ))}
                      <option value="last">月末</option>
                    </select>
                    <span className="text-sm text-muted-foreground">
                      {reminderDayOfMonth <= 0 ? "月末" : `${reminderDayOfMonth}日`}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">時刻（任意）</label>
                    <Input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full max-w-[140px]"
                      disabled={reminderSubmitting}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <span className="text-sm font-medium text-foreground mb-2 block">リマインド方法</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reminderMode"
                          checked={reminderMode === "time"}
                          onChange={() => setReminderMode("time")}
                          className="rounded-full border-input"
                        />
                        <span className="text-sm">時間で指定</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reminderMode"
                          checked={reminderMode === "date"}
                          onChange={() => setReminderMode("date")}
                          className="rounded-full border-input"
                        />
                        <span className="text-sm">日付で指定</span>
                      </label>
                    </div>
                  </div>
                  {reminderMode === "time" && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">時刻</label>
                      <Input
                        type="time"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className="w-full max-w-[140px]"
                        disabled={reminderSubmitting}
                      />
                    </div>
                  )}
                  {reminderMode === "date" && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">日付</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="date"
                          value={reminderDate}
                          onChange={(e) => setReminderDate(e.target.value)}
                          className="w-full max-w-[180px]"
                          disabled={reminderSubmitting}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={setReminderDateToFirst} disabled={reminderSubmitting}>
                          月初（1日）
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={setReminderDateToLast} disabled={reminderSubmitting}>
                          月末
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => !reminderSubmitting && setShowReminderModal(false)}
                  disabled={reminderSubmitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={reminderSubmitting || !reminderTitle.trim()}>
                  {reminderSubmitting ? "設定中..." : "設定する"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showReminderListModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => {
            if (!reminderEditId && !reminderDeleteConfirm) setShowReminderListModal(false);
          }}
        >
          <div
            className="bg-card border rounded-lg shadow-lg max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">リマインド一覧</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowReminderListModal(false)} aria-label="閉じる">
                ×
              </Button>
            </div>
            <div className="p-4 overflow-auto">
              {reminderTodos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">リマインド設定付きのTodoはありません。</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-foreground">作業名</th>
                      <th className="text-left py-2 px-3 font-medium text-foreground">リマインド日時</th>
                      <th className="text-left py-2 px-3 font-medium text-foreground w-20">毎月</th>
                      <th className="text-right py-2 px-3 font-medium text-foreground w-36">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminderTodos.map((t) => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3">
                          {reminderEditId === t.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={reminderEditTitle}
                                onChange={(e) => setReminderEditTitle(e.target.value)}
                                className="flex-1 min-w-0"
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && handleReminderEditSave()}
                              />
                              <Button size="sm" onClick={handleReminderEditSave}>
                                保存
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setReminderEditId(null)}>
                                キャンセル
                              </Button>
                            </div>
                          ) : (
                            <span className="font-medium">{t.text}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {t.isMonthlyRecurring
                            ? (() => {
                                const d = t.reminderDate ? new Date(t.reminderDate + "T12:00:00") : t.date;
                                const day = d.getDate();
                                const isLast = isSameDay(d, endOfMonth(d));
                                const dayLabel = isLast ? "月末" : `${day}日`;
                                const timePart = t.reminderTime != null && t.reminderTime !== "" ? ` ${t.reminderTime}` : "";
                                return `毎月 ${dayLabel}${timePart}`;
                              })()
                            : t.reminderTime != null && t.reminderTime !== ""
                              ? `${format(t.date, "yyyy/MM/dd")} ${t.reminderTime}`
                              : t.reminderDate != null && t.reminderDate !== ""
                                ? format(new Date(t.reminderDate + "T12:00:00"), "yyyy/MM/dd")
                                : format(t.date, "yyyy/MM/dd")}
                        </td>
                        <td className="py-2 px-3">{t.isMonthlyRecurring ? "する" : "—"}</td>
                        <td className="py-2 px-3 text-right">
                          {reminderDeleteConfirm?.id === t.id ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button size="sm" variant="destructive" onClick={() => handleReminderDelete("all")}>
                                削除
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setReminderDeleteConfirm(null)}>
                                キャンセル
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              {reminderEditId !== t.id && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setReminderEditId(t.id);
                                      setReminderEditTitle(t.text);
                                    }}
                                    title="名前変更"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() =>
                                      t.isMonthlyRecurring
                                        ? setReminderDeleteConfirm({ id: t.id, title: t.text, isMonthly: true })
                                        : handleReminderDelete("single", t.id)
                                    }
                                    title="削除"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {reminderTodos.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">※ 毎月リマインドを設定したタスクは、完了すると翌月の同じ日に新しいタスクが自動で作成されます</p>
              )}
            </div>
          </div>
        </div>
      )}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowNotifications(false)}>
          <div className="bg-card border rounded-lg shadow-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Avatar seed={avatarSeed} size={32} />
                <h2 className="text-lg font-semibold">お知らせ一覧</h2>
                <span className="text-sm text-muted-foreground">{displayName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowNotifications(false)} aria-label="閉じる">×</Button>
            </div>
            <ul className="p-4 overflow-y-auto space-y-2">
              {notifications.length === 0 ? (
                <li className="text-sm text-muted-foreground">お知らせはありません</li>
              ) : (
                notifications.map((n) => (
                  <li key={n.id} className="text-sm py-1 border-b border-border/50 last:border-0">
                    {format(new Date(n.created_at), "H時m分")}：{n.message}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {showWeeklyReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowWeeklyReport(false)}>
          <div className="bg-card border rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">今週のレポート</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowWeeklyReport(false)} aria-label="閉じる">×</Button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <p className="text-sm text-muted-foreground">
                合計完了数: {weeklyReport.total}件（高: {weeklyReport.byPriority.high} / 中: {weeklyReport.byPriority.medium} / 低: {weeklyReport.byPriority.low}）
              </p>
              {weeklyReport.sortedDates.length === 0 ? (
                <p className="text-sm text-muted-foreground">今週は完了したタスクがありません</p>
              ) : (
                <div className="space-y-4">
                  {weeklyReport.sortedDates.map((dateKey) => {
                    const date = new Date(dateKey + "T12:00:00");
                    const weekDay = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
                    const byUser = weeklyReport.byDate[dateKey];
                    return (
                      <div key={dateKey}>
                        <h3 className="font-medium text-sm mb-2">■ {format(date, "M/d")}({weekDay})</h3>
                        <ul className="space-y-2 pl-4">
                          {Object.entries(byUser).map(([user, tasks]) => {
                            const userSeed = getAvatarSeedForUsername(user === "自分" ? displayName : user);
                            return (
                            <li key={user}>
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar seed={userSeed} size={32} />
                                {user !== "自分" && <p className="text-xs text-muted-foreground">{user}さんの成果</p>}
                                {user === "自分" && <p className="text-xs text-muted-foreground">自分</p>}
                              </div>
                              <ul className="list-disc list-inside space-y-0.5">
                                {tasks.map((t) => (
                                  <li key={t.id}>{t.text}</li>
                                ))}
                              </ul>
                            </li>
                          ); })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <Button className="w-full" onClick={copyReportText}>
                <Copy className="h-4 w-4 mr-2" />
                報告用テキストをコピー
              </Button>
            </div>
          </div>
        </div>
      )}

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
