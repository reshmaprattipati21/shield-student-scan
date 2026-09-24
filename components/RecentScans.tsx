"use client";

import React, { useEffect, useState } from "react";
import { History, ShieldAlert, ShieldCheck, AlertTriangle, RefreshCw, ChevronRight } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface ScanRecord {
  id: string;
  created_at: string;
  input_type: string;
  risk_score: number;
  risk_level: string;
  summary: string;
  flags: any[];
  recommendations: string[];
  raw_content?: string;
}

interface RecentScansProps {
  onSelectScan: (scan: ScanRecord) => void;
  refreshTrigger?: number;
}

export default function RecentScans({ onSelectScan, refreshTrigger }: RecentScansProps) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchScans = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      // Mock history when Supabase credentials are not set
      setScans([
        {
          id: "mock-1",
          created_at: new Date(Date.now() - 3600000).toISOString(),
          input_type: "pdf",
          risk_score: 85,
          risk_level: "High",
          summary: "High-risk scam offer letter detected requiring $250 registration fee via gift cards.",
          flags: [
            { phrase: "Registration Fee $250", category: "Upfront Payment Scam", reason: "Employers do not charge registration fees." }
          ],
          recommendations: ["Do not transfer funds", "Verify company on official domain"]
        },
        {
          id: "mock-2",
          created_at: new Date(Date.now() - 86400000).toISOString(),
          input_type: "text",
          risk_score: 15,
          risk_level: "Low",
          summary: "Legitimate tech company job offer with official domain communication.",
          flags: [],
          recommendations: ["Review contract terms with legal advisor"]
        }
      ]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        console.warn("Supabase fetch notice:", error.message);
      } else if (data) {
        setScans(data);
      }
    } catch (err) {
      console.error("Failed to load recent scans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [refreshTrigger]);

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" /> Recent Security Scans
        </h3>
        <button
          onClick={fetchScans}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all text-xs flex items-center gap-1 font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs text-slate-500 font-mono">
          Loading scan database records...
        </div>
      ) : scans.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-500 font-mono">
          No previous scans recorded yet. Run your first scan above!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scans.map((scan) => {
            const isHigh = scan.risk_level === "High" || scan.risk_score >= 70;
            const isMed = scan.risk_level === "Medium" || (scan.risk_score >= 35 && scan.risk_score < 70);

            return (
              <div
                key={scan.id}
                onClick={() => onSelectScan(scan)}
                className="group p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {scan.input_type}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isHigh
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : isMed
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    SCORE {scan.risk_score}/100
                  </span>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {scan.summary}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/60">
                  <span>{new Date(scan.created_at).toLocaleDateString()}</span>
                  <span className="text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                    View <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
