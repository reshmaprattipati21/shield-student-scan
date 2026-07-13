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

// ─── localStorage helpers (fallback) ─────────────────────────────────────────

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
  window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

// ─── addReport — writes to localStorage AND Supabase ─────────────────────────

export function addReport(input: {
  user_id: string;
  company_name: string;
  platform: string;
  description: string;
}): Report {
  const item: Report = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    ...input,
    created_at: new Date().toISOString(),
  };

  // Write to localStorage for instant UI reactivity
  writeLocal([item, ...readLocal()]);

  // Also persist to Supabase
  if (input.user_id) {
    supabase
      .from("scam_reports")
      .insert({
        user_id: input.user_id,
        company_name: input.company_name,
        platform: input.platform,
        description: input.description,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[Reports] Supabase insert failed:", error.message);
        }
      });
  }

  return item;
}

// ─── deleteReport — deletes from localStorage AND Supabase ───────────────────

export function deleteReport(id: string, userId?: string) {
  writeLocal(readLocal().filter((r) => r.id !== id));

  // Also delete from Supabase
  if (userId) {
    supabase
      .from("scam_reports")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[Reports] Supabase delete failed:", error.message);
        }
      });
  }
}

// ─── useReports — reads from Supabase when authenticated, else localStorage ──

export function useReports(userId?: string) {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (userId) {
      // Authenticated — fetch from Supabase
      setLoading(true);
      const { data, error } = await supabase
        .from("scam_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Reports] Supabase fetch failed:", error.message);
        // Fall back to localStorage
        setItems(readLocal());
      } else {
        setItems(
          (data ?? []).map((row) => ({
            id: row.id,
            user_id: row.user_id,
            company_name: row.company_name,
            platform: row.platform,
            description: row.description,
            created_at: row.created_at,
          }))
        );
      }
      setLoading(false);
    } else {
      // Unauthenticated — use localStorage
      setItems(readLocal());
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();

    const onChange = () => {
      load();
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  return { items, loading, reload: load };
}
