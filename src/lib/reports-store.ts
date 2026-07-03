import { useCallback, useEffect, useState } from "react";

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

function read(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(items: Report[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function seedIfEmpty() {
  if (read().length > 0) return;
  const now = Date.now();
  write([
    {
      id: `seed-${now}-1`,
      user_id: "seed",
      company_name: "BrightPath Interns",
      platform: "WhatsApp",
      description:
        "Recruiter asked for a ₹2,500 'training kit' deposit before sharing the offer letter. No company website, only a Gmail address.",
      created_at: new Date(now - 1000 * 60 * 45).toISOString(),
    },
    {
      id: `seed-${now}-2`,
      user_id: "seed",
      company_name: "TCS-Internships-Portal",
      platform: "Telegram",
      description:
        "Fake TCS lookalike domain (tcs-internships-portal.com) offering guaranteed placement after paying a ₹999 verification fee.",
      created_at: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    },
  ]);
}

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
  write([item, ...read()]);
  return item;
}

export function deleteReport(id: string) {
  write(read().filter((r) => r.id !== id));
}

export function useReports() {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    seedIfEmpty();
    setItems(read());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onChange = () => setItems(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  return { items, loading, reload: load };
}
