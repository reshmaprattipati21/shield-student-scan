"use client";

import React from "react";
import { ShieldAlert, Cpu, Database, CheckCircle2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function Header() {
  const dbConnected = isSupabaseConfigured();

  return (
    <header className="border-b border-slate-800 bg-[#0b0f19]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 shadow-glow-cyan">
            <ShieldAlert className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white flex items-center gap-2">
              Scam<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Shield</span>
            </h1>
            <p className="text-xs text-slate-400">AI-Powered Scam & Fake Offer Letter Detector</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="hidden sm:flex items-center space-x-4 text-xs font-mono">


          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300">
            <Database className={`w-3.5 h-3.5 ${dbConnected ? "text-emerald-400" : "text-amber-400"}`} />
            <span>{dbConnected ? "Database Live" : "Local Engine"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
