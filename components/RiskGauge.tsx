"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Activity } from "lucide-react";

interface RiskGaugeProps {
  score: number;
  level: "Low" | "Medium" | "High";
  summary: string;
}

export default function RiskGauge({ score, level, summary }: RiskGaugeProps) {
  // Determine styling based on score & level
  let badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-glow-emerald";
  let barColor = "from-emerald-500 to-teal-400";
  let icon = <ShieldCheck className="w-8 h-8 text-emerald-400" />;
  let label = "SAFE / LOW RISK";
  let textColor = "text-emerald-400";

  if (score >= 70 || level === "High") {
    badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-glow-rose";
    barColor = "from-rose-500 via-amber-500 to-rose-600";
    icon = <ShieldAlert className="w-8 h-8 text-rose-400 animate-pulse" />;
    label = "HIGH RISK SCAM DETECTED";
    textColor = "text-rose-400";
  } else if (score >= 35 || level === "Medium") {
    badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-glow-amber";
    barColor = "from-amber-500 to-yellow-400";
    icon = <AlertTriangle className="w-8 h-8 text-amber-400" />;
    label = "SUSPICIOUS / MEDIUM RISK";
    textColor = "text-amber-400";
  }

  return (
    <div className="glass-card rounded-2xl p-6 shadow-2xl border border-slate-800 space-y-6">
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
            {icon}
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Fraud Threat Level
            </h3>
            <p className={`text-lg font-extrabold ${textColor}`}>{label}</p>
          </div>
        </div>

        <div className={`px-4 py-1.5 rounded-full border text-xs font-mono font-semibold ${badgeColor}`}>
          {level.toUpperCase()} THREAT
        </div>
      </div>

      {/* Main Score Display & Meter */}
      <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800/80">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Calculated Risk Index</span>
          <div className="flex items-baseline space-x-1">
            <span className={`text-4xl font-black ${textColor}`}>{score}</span>
            <span className="text-slate-500 font-mono text-sm">/ 100</span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full h-4 bg-slate-950 rounded-full p-0.5 overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
            style={{ width: `${Math.max(score, 5)}%` }}
          />
        </div>

        {/* Scale Indicators */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2 px-1">
          <span className="text-emerald-500/70">0 (Safe)</span>
          <span className="text-amber-500/70">50 (Suspicious)</span>
          <span className="text-rose-500/70">100 (Critical Fraud)</span>
        </div>
      </div>

      {/* Summary Box */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/60 text-sm text-slate-300 leading-relaxed">
        <p className="font-semibold text-slate-200 text-xs font-mono uppercase tracking-wider mb-1 text-cyan-400">
          Executive Summary:
        </p>
        <p className="text-slate-300">{summary}</p>
      </div>
    </div>
  );
}
