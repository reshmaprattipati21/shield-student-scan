import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Report = {
  id: string;
  user_id: string;
  company_name: string;
  platform: string;
  description: string;
  created_at: string;
};

const KEY = "scamshield:reports:v1";
const EVENT = "scamshield:reports-change";
const MAX = 200;

function normalizeLocal(items: Report[]) {
  return items.slice(0, MAX);
}

// ─── localStorage helpers (fallback for guest mode) ─────────────────────────

function readLocal(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocal(items: Report[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(normalizeLocal(items)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch (error) {
    console.error("[Reports] Failed to write local reports:", error);
  }
}

function mergeLocalWithRemote(remote: Report[], userId?: string): Report[] {
  const local = readLocal().filter((item) => !userId || item.user_id === userId);
  const byId = new Map<string, Report>();

  for (const item of [...remote, ...local]) {
    byId.set(item.id, item);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ─── addReport — writes to Supabase first when authenticated ────────────────

export async function addReport(input: {
  user_id: string;
  company_name: string;
  platform: string;
  description: string;
}): Promise<Report> {
  const localFallback: Report = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    ...input,
    created_at: new Date().toISOString(),
  };

  if (input.user_id) {
    try {
      const { data, error } = await supabase
        .from("scam_reports")
        .insert({
          user_id: input.user_id,
          company_name: input.company_name,
          platform: input.platform,
          description: input.description,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("No report data returned from Supabase insert");
      }

      const insertedReport: Report = {
        id: data.id,
        user_id: data.user_id,
        company_name: data.company_name,
        platform: data.platform,
        description: data.description,
        created_at: data.created_at,
      };

      const next = [insertedReport, ...readLocal().filter((item) => item.id !== insertedReport.id)];
      writeLocal(next);
      return insertedReport;
    } catch (error) {
      console.error("[Reports] Supabase insert failed:", error);
      const next = [localFallback, ...readLocal().filter((item) => item.id !== localFallback.id)];
      writeLocal(next);
      return localFallback;
    }
  }

  // Fallback for unauthenticated users (localStorage)
  const next = [localFallback, ...readLocal()];
  writeLocal(next);
  return localFallback;
}

// ─── deleteReport — deletes from Supabase AND updates local state ───────────

export async function deleteReport(id: string, userId?: string) {
  if (userId) {
    const { error } = await supabase
      .from("scam_reports")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Reports] Supabase delete failed:", error.message);
      throw error;
    }
  }

  const next = readLocal().filter((r) => r.id !== id);
  writeLocal(next);
}

// ─── useReports — fetches global feed + subscribes to Supabase Realtime ─────

export function useReports(userId?: string) {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    if (userId) {
      setLoading(true);
      const { data, error } = await supabase
        .from("scam_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Reports] Supabase fetch failed:", error.message);
        setItems(readLocal().filter((item) => item.user_id === userId));
      } else {
        const remote = (data ?? []).map((row) => ({
          id: row.id,
          user_id: row.user_id,
          company_name: row.company_name,
          platform: row.platform,
          description: row.description,
          created_at: row.created_at,
        }));

        const merged = mergeLocalWithRemote(remote, userId);
        setItems(merged);
      }
      setLoading(false);
    } else {
      setItems(readLocal());
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();

    // Listen for local tab/custom event triggers
    const onChange = () => {
      load();
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);

    // Subscribe to Supabase Realtime for instant multi-account synchronization
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (userId) {
      channel = supabase
        .channel("public:scam_reports")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "scam_reports" },
          () => {
            load();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [load, userId]);

  return { items, loading, reload: load };
}