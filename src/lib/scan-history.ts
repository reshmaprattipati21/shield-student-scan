import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ScanType = "url" | "text" | "pdf";
export type ScanHistoryEntry = {
  id: string;
  scan_type: ScanType;
  target: string;
  score: number;
  risk: string;
  flags?: string[];
  created_at: string;
};

const KEY = "scamshield:scan-history:v1";
const EVENT = "scamshield:scan-history-change";
const MAX = 50;

// ─── localStorage helpers (fallback for unauthenticated users) ───────────────

export function seedMockHistoryIfEmpty() {
  if (typeof window === "undefined") return;
  const existing = readLocal();
  if (existing.length > 0) return;
  const now = Date.now();
  const mock: ScanHistoryEntry[] = [
    {
      id: `seed-${now}-1`,
      scan_type: "url",
      target: "internshala.com/internship/detail/sde-bangalore",
      score: 8,
      risk: "low",
      created_at: new Date(now - 1000 * 60 * 30).toISOString(),
    },
    {
      id: `seed-${now}-2`,
      scan_type: "text",
      target: "Congratulations! You've been pre-selected for a remote internship — please confirm…",
      score: 42,
      risk: "medium",
      flags: ["Pending review"],
      created_at: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
    },
  ];
  writeLocal(mock);
}

function readLocal(): ScanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocal(items: ScanHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch (err) {
    console.error("Failed to write to scan history:", err);
  }
}

// ─── recordScan — writes to localStorage AND Supabase (if authenticated) ─────

export function recordScan(entry: {
  scan_type: ScanType;
  target: string;
  score: number;
  risk: string;
  flags?: string[];
  userId?: string;
}) {
  if (typeof window === "undefined") return;

  const item: ScanHistoryEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    scan_type: entry.scan_type,
    target: (entry.target || "").slice(0, 240),
    score: Math.round(entry.score),
    risk: entry.risk,
    flags: entry.flags,
    created_at: new Date().toISOString(),
  };

  // Always write to localStorage for instant UI reactivity
  const next = [item, ...readLocal()].slice(0, MAX);
  writeLocal(next);

  // If the user is authenticated, also persist to Supabase
  if (entry.userId) {
    supabase
      .from("scan_history")
      .insert({
        user_id: entry.userId,
        scan_type: entry.scan_type,
        target: item.target,
        score: item.score,
        risk: item.risk,
        flags: (entry.flags ?? []) as unknown as import("@/integrations/supabase/types").Json,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[ScanHistory] Supabase insert failed:", error.message);
        }
      });
  }
}

// ─── clearScanHistory — clears localStorage AND Supabase (if authenticated) ──

export function clearScanHistory(userId?: string) {
  writeLocal([]);

  if (userId) {
    supabase
      .from("scan_history")
      .delete()
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) {
          console.error("[ScanHistory] Supabase delete failed:", error.message);
        }
      });
  }
}

// ─── useScanHistory — reads from Supabase when authenticated, else localStorage

export function useScanHistory(limit = 12, userId?: string) {
  const [items, setItems] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    // If authenticated, fetch from Supabase
    if (userId) {
      setLoading(true);
      const { data, error } = await supabase
        .from("scan_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[ScanHistory] Supabase fetch failed:", error.message);
        // Fall back to localStorage on error
        setItems(readLocal().slice(0, limit));
      } else {
        const mapped: ScanHistoryEntry[] = (data ?? []).map((row) => ({
          id: row.id,
          scan_type: row.scan_type as ScanType,
          target: row.target,
          score: row.score,
          risk: row.risk,
          flags: Array.isArray(row.flags) ? (row.flags as string[]) : undefined,
          created_at: row.created_at,
        }));
        setItems(mapped);
      }
      setLoading(false);
    } else {
      // Unauthenticated — use localStorage
      setItems(readLocal().slice(0, limit));
    }
  }, [limit, userId]);

  useEffect(() => {
    load();

    // Listen for localStorage events (cross-tab + same-tab custom event)
    const onChange = () => {
      // Re-load — if authenticated this will re-fetch from Supabase
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
