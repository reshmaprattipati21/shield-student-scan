"use client";

import React from "react";
import { CheckSquare, ShieldCheck, ArrowRight, Lock } from "lucide-react";

interface ActionPlanProps {
  recommendations: string[];
}

export default function ActionPlan({ recommendations }: ActionPlanProps) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-cyan-400" /> Recommended Action Plan
        </h3>
        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
          <Lock className="w-3 h-3 text-emerald-400" /> Security Protocol
        </span>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec, index) => (
          <div
            key={index}
            className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/30 transition-all duration-200"
          >
            <div className="mt-0.5 p-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex-shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {rec}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
