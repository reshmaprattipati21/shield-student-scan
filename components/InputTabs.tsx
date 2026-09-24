"use client";

import React, { useState, useRef } from "react";
import { MessageSquareText, Globe, FileText, Upload, Sparkles, Loader2, FileCheck, AlertCircle } from "lucide-react";

interface InputTabsProps {
  onAnalyze: (inputType: "text" | "url" | "pdf", content: string) => void;
  isLoading: boolean;
}

export default function InputTabs({ onAnalyze, isLoading }: InputTabsProps) {
  const [activeTab, setActiveTab] = useState<"text" | "url" | "pdf">("text");
  const [textContent, setTextContent] = useState<string>("");
  const [urlContent, setUrlContent] = useState<string>("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preset sample scams for 1-click testing
  const sampleScamOffer = `DEAR CANDIDATE,
WE ARE PLEASED TO OFFER YOU THE POSITION OF REMOTE DATA ENTRY OPERATOR AT GLOBAL TECH CORP.
YOUR SALARY WILL BE $4,500 PER MONTH ($60/HR) WITH IMMEDIATE START DATE.

PLEASE NOTE: AS PER COMPANY POLICY, ALL NEW EMPLOYEES MUST DEPOSIT A ONE-TIME REFUNDABLE REGISTRATION FEE OF $250 FOR YOUR HOME OFFICE LAPTOP & SECURITY SOFTWARE PACKAGE.
PAYMENT MUST BE SENT VIA ZELLE, WIRE TRANSFER, OR STEAM GIFT CARDS WITHIN 24 HOURS TO LOCK YOUR POSITION.

RECRUITER EMAIL: HR.GLOBALTECHCORP@GMAIL.COM
INTERVIEW TELEGRAM: @RECRUITER_GLOBALTECH`;

  const samplePhishingSMS = `URGENT SECURITY ALERT: Your bank account #8492 has been suspended due to unauthorized login attempts. Verify your details immediately at http://secure-bank-login-update.net/verify or your funds will be permanently locked within 12 hours.`;

  const sampleLegitOffer = `Dear Alex,
We are excited to formally offer you the role of Software Engineer at Acme Technologies, Inc.
Your starting base annual salary will be $95,000, paid semi-monthly, with standard health benefits and 401(k) matching.
Please review the attached formal offer packet. You may sign and submit your acceptance through our secure HR portal at careers.acmetech.com by August 15th.
Best regards,
Sarah Jenkins
Talent Acquisition Team | Acme Technologies (hr@acmetech.com)`;

  const handleFileChange = (file: File) => {
    if (file.type !== "application/pdf") {
      setErrorMsg("Please upload a valid PDF file (.pdf).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File size exceeds 10MB limit.");
      return;
    }

    setErrorMsg("");
    setPdfFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      setPdfBase64(base64String);
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read PDF file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (activeTab === "text") {
      if (!textContent.trim()) {
        setErrorMsg("Please enter text or email content to scan.");
        return;
      }
      onAnalyze("text", textContent);
    } else if (activeTab === "url") {
      if (!urlContent.trim()) {
        setErrorMsg("Please enter a website URL or domain.");
        return;
      }
      let targetUrl = urlContent.trim();
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl;
      }
      onAnalyze("url", targetUrl);
    } else if (activeTab === "pdf") {
      if (!pdfBase64) {
        setErrorMsg("Please select or drop a PDF offer letter to scan.");
        return;
      }
      onAnalyze("pdf", pdfBase64);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 shadow-2xl border border-slate-800">
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2 sm:gap-4 overflow-x-auto pb-1">
        <button
          onClick={() => {
            setActiveTab("text");
            setErrorMsg("");
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
            activeTab === "text"
              ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-glow-cyan"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <MessageSquareText className="w-4 h-4" />
          <span>Text / Email</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("url");
            setErrorMsg("");
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
            activeTab === "url"
              ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-glow-cyan"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Website URL</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("pdf");
            setErrorMsg("");
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
            activeTab === "pdf"
              ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-glow-cyan"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Offer Letter PDF</span>
        </button>
      </div>

      {/* Preset Quick Load Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Quick Samples:
        </span>
        <button
          type="button"
          onClick={() => {
            setActiveTab("text");
            setTextContent(sampleScamOffer);
            setErrorMsg("");
          }}
          className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all"
        >
          🚨 Fake Job Offer Scam
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("text");
            setTextContent(samplePhishingSMS);
            setErrorMsg("");
          }}
          className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition-all"
        >
          ⚠️ Bank Phishing SMS
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("text");
            setTextContent(sampleLegitOffer);
            setErrorMsg("");
          }}
          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-all"
        >
          ✅ Legitimate Job Offer
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit}>
        {activeTab === "text" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Paste suspicious job offer, email message, or text message:
            </label>
            <textarea
              rows={7}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="e.g. Dear candidate, we are offering $50/hr data entry role. Please pay $100 registration fee..."
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all resize-none"
            />
          </div>
        )}

        {activeTab === "url" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Enter suspicious company website or recruiter URL:
            </label>
            <div className="relative">
              <Globe className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={urlContent}
                onChange={(e) => setUrlContent(e.target.value)}
                placeholder="https://suspicious-hiring-portal.net/offer"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>
        )}

        {activeTab === "pdf" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Upload Offer Letter PDF document:
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? "border-cyan-400 bg-cyan-500/10"
                  : pdfFile
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              {pdfFile ? (
                <div className="flex flex-col items-center space-y-2">
                  <FileCheck className="w-10 h-10 text-emerald-400 animate-bounce" />
                  <p className="font-semibold text-emerald-300 text-sm">{pdfFile.name}</p>
                  <p className="text-xs text-slate-400">
                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB PDF Loaded
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPdfFile(null);
                      setPdfBase64("");
                    }}
                    className="text-xs text-rose-400 underline hover:text-rose-300 pt-1"
                  >
                    Remove PDF
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <div className="p-3 rounded-full bg-slate-800 text-cyan-400 border border-slate-700">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Drag & Drop your PDF file here, or <span className="text-cyan-400 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Supports PDF offer letters up to 10MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error message alert */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 px-6 rounded-xl font-bold text-sm tracking-wide text-white transition-all duration-200 shadow-lg flex items-center justify-center space-x-2 ${
              isLoading
                ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                : "bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:via-blue-500 hover:to-purple-500 shadow-glow-cyan active:scale-[0.99]"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span>Analyzing Content...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-cyan-200" />
                <span>Run Scam & Fraud Analysis</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
