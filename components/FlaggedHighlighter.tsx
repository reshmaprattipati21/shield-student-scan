"use client";

import React from "react";
import { Flag, AlertOctagon, Info, ShieldAlert } from "lucide-react";

interface FlagItem {
  phrase: string;
  category: string;
  reason: string;
  type?: "warning" | "success" | "info";
}

interface FlaggedHighlighterProps {
  flags: FlagItem[];
  rawContent?: string;
}

export default function FlaggedHighlighter({ flags, rawContent }: FlaggedHighlighterProps) {
  if (!flags || flags.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-sm font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Flag className="w-4 h-4 text-emerald-400" /> Detected Risk Flags (0)
        </h3>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center space-x-3">
          <Info className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>No major high-risk phrases or scam indicators were detected in the analyzed content.</span>
        </div>
      </div>
    );
  }

  const badFlags = flags.filter(f => !f.type || f.type === "warning");
  const goodFlags = flags.filter(f => f.type === "success" || f.type === "info");

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" /> Analysis Signals & Indicators ({flags.length})
        </h3>
        {badFlags.length > 0 ? (
          <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
            Attention Required
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            Passed Checks
          </span>
        )}
      </div>

      {/* Flagged Items Cards Grid */}
      <div className="grid grid-cols-1 gap-4">
        {flags.map((flag, idx) => {
          const isGood = flag.type === "success" || flag.type === "info";
          return (
          <div
            key={idx}
            className={`group p-4 rounded-xl bg-slate-900/90 border transition-all duration-200 shadow-sm ${
              isGood ? "border-emerald-500/30 hover:border-emerald-500/60" : "border-rose-500/30 hover:border-rose-500/60"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center space-x-2">
                <span className={`p-1.5 rounded-lg border ${
                  isGood ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}>
                  {isGood ? <Info className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
                </span>
                <span className={`font-semibold text-sm px-2.5 py-0.5 rounded border font-mono ${
                  isGood ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" : "text-rose-300 bg-rose-500/10 border-rose-500/20"
                }`}>
                  "{flag.phrase}"
                </span>
              </div>
              <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                {flag.category}
              </span>
            </div>

            <p className="text-xs text-slate-300 pl-8 leading-relaxed">
              <span className="text-slate-500 font-mono">Analysis: </span>
              {flag.reason}
            </p>
          </div>
        )})}
      </div>

      {/* Optional raw text snippet with highlighted keywords */}
      {rawContent && (
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <p className="text-xs font-mono text-slate-400 mb-2">Extracted Analyzed Text Extract:</p>
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
            {rawContent}
          </div>
        </div>
      )}
    </div>
  );
}
