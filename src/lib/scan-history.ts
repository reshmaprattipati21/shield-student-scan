import { useEffect, useState, useCallback } from "react";

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

function read(): ScanHistoryEntry[] {
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

function write(items: ScanHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function recordScan(entry: {
  scan_type: ScanType;
  target: string;
  score: number;
  risk: string;
  flags?: string[];
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
  const next = [item, ...read()].slice(0, MAX);
  write(next);
}

export function clearScanHistory() {
  write([]);
}

export function useScanHistory(limit = 12) {
  const [items, setItems] = useState<ScanHistoryEntry[]>([]);

  const load = useCallback(() => {
    setItems(read().slice(0, limit));
  }, [limit]);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  return { items, loading: false, reload: load };
}
