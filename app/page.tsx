"use client";

import React, { useState, useRef } from "react";
import Header from "@/components/Header";
import InputTabs from "@/components/InputTabs";
import RiskGauge from "@/components/RiskGauge";
import FlaggedHighlighter from "@/components/FlaggedHighlighter";
import ActionPlan from "@/components/ActionPlan";
import RecentScans from "@/components/RecentScans";
import { ShieldCheck, Sparkles, AlertCircle, Terminal, CheckCircle2 } from "lucide-react";

interface ScanResult {
  id: string;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  summary: string;
  flags: Array<{ phrase: string; category: string; reason: string }>;
  recommendations: string[];
  extractedText?: string;
}

export default function Home() {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const resultsRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = async (inputType: "text" | "url" | "pdf", content: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputType, content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze content.");
      }

      setResult(data);
      setRefreshTrigger((prev) => prev + 1);

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("Scan error:", err);
      setError(err.message || "An error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecentScan = (scanRecord: any) => {
    setResult({
      id: scanRecord.id,
      riskScore: scanRecord.risk_score,
      riskLevel: scanRecord.risk_level as "Low" | "Medium" | "High",
      summary: scanRecord.summary,
      flags: scanRecord.flags || [],
      recommendations: scanRecord.recommendations || [],
      extractedText: scanRecord.raw_content,
    });

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100 font-sans">
      {/* Top Sticky Header */}
      <Header />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Banner / Introduction */}
        <section className="text-center max-w-3xl mx-auto space-y-3 pt-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Cyber Fraud Inspection Engine</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Verify Before You Trust
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Protect yourself against fake employment offer letters, registration fee scams, phishing emails, and suspicious recruiter URLs.
          </p>
        </section>

        {/* Input Panel Component */}
        <section className="max-w-4xl mx-auto">
          <InputTabs onAnalyze={handleAnalyze} isLoading={loading} />
        </section>

        {/* Error Alert if any */}
        {error && (
          <div className="max-w-4xl mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Analysis Results Display */}
        {result && (
          <section ref={resultsRef} className="max-w-5xl mx-auto space-y-6 pt-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-cyan-400" /> Analysis Results & Cyber Threat Audit
              </h3>
              <span className="text-xs font-mono text-slate-500">ID: {result.id}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Risk Gauge */}
              <div className="lg:col-span-5">
                <RiskGauge
                  score={result.riskScore}
                  level={result.riskLevel}
                  summary={result.summary}
                />
              </div>

              {/* Right Column: Flagged Highlights & Action Plan */}
              <div className="lg:col-span-7 space-y-6">
                <FlaggedHighlighter
                  flags={result.flags}
                  rawContent={result.extractedText}
                />
                <ActionPlan recommendations={result.recommendations} />
              </div>
            </div>
          </section>
        )}

        {/* Recent Scans History Section */}
        <section className="max-w-5xl mx-auto pt-6">
          <RecentScans
            onSelectScan={handleSelectRecentScan}
            refreshTrigger={refreshTrigger}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060910] py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>ScamShield © {new Date().getFullYear()} — Built for Cybersecurity & Scam Protection.</p>
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1"><Terminal className="w-3.5 h-3.5 text-cyan-400" /> Next.js 15</span>
            <span>•</span>
            <span>Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
