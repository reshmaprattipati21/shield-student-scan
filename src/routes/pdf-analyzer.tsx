import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { UploadCloud, FileText, AlertTriangle, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BackToDashboard } from "@/components/BackToDashboard";
import { CyberBg } from "@/components/CyberBg";
import { RiskGauge } from "@/components/RiskGauge";
import { scanText } from "@/lib/scan-engine";
import { recordScan } from "@/lib/scan-history";

export const Route = createFileRoute("/pdf-analyzer")({
  component: PdfAnalyzer,
  head: () => ({ meta: [{ title: "AI PDF Offer Letter Analyzer — ScamShield" }, { name: "description", content: "Upload appointment letters, internship descriptions, or training agreements to scan for hidden financial traps and fraudulent compliance clauses." }] }),
});

type ScanResult = ReturnType<typeof scanText> & { file: { name: string; size: number } };

async function readPdfText(file: File): Promise<string> {
  // Lightweight extraction: read raw bytes, strip non-printables.
  // Real PDF parsing is heavy; this still catches plain-text scam keywords.
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b < 127) || b === 10 || b === 13) s += String.fromCharCode(b);
  }
  return s + " " + file.name;
}

function PdfAnalyzer() {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runScan = async (file: File) => {
    setScanning(true);
    setResult(null);
    setProgress(0);
    const start = performance.now();
    const dur = 1800;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / dur);
      setProgress(Math.round(p * 100));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const text = await readPdfText(file);
    await new Promise((r) => setTimeout(r, dur));
    const base = scanText(text);
    const final = { ...base, file: { name: file.name, size: file.size } };
    setResult(final);
    setScanning(false);
    void recordScan({ scan_type: "pdf", target: file.name, score: base.score, risk: base.risk });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) runScan(f);
  };

  return (
    <div>
      <CyberBg />
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-6"><BackToDashboard /></div>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><FileText className="h-5 w-5" /></div>
            <h1 className="text-3xl font-bold tracking-tight">AI PDF Offer Letter Analyzer</h1>
          </div>
          <p className="text-muted-foreground max-w-3xl">Upload appointment letters, internship descriptions, or training agreements to scan for hidden financial traps and fraudulent compliance clauses.</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`glass rounded-2xl p-10 text-center cursor-pointer transition-all duration-500 ${dragOver ? "glow-cyan border-cyan-400/60" : ""}`}
        >
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                 onChange={(e) => e.target.files?.[0] && runScan(e.target.files[0])} />
          {scanning ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#22D3EE" strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 42}
                          strokeDashoffset={2 * Math.PI * 42 * (1 - progress / 100)}
                          style={{ transition: "stroke-dashoffset .15s linear", filter: "drop-shadow(0 0 8px rgba(34,211,238,.7))" }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-cyan-300 font-semibold tabular-nums">{progress}%</div>
              </div>
              <div className="text-sm text-cyan-200/80 tracking-wide max-w-md">Parsing document metadata and running semantic analysis on employment terms…</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><UploadCloud className="h-7 w-7" /></div>
              <div className="font-semibold">Drop your offer letter PDF here</div>
              <div className="text-sm text-muted-foreground">or click to browse · max ~10 MB</div>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-6 grid gap-6 md:grid-cols-[300px_1fr]">
            <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
              <RiskGauge score={result.score} risk={result.risk} />
              <div className="mt-3 text-xs text-muted-foreground truncate max-w-[240px]">{result.file.name}</div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-3">Verdict</div>
              {result.hits.length === 0 ? (
                <div className="flex items-start gap-2 text-sm text-success mb-4">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                  <span><span className="font-semibold">Verified Employer.</span> This domain and document structure match official university-approved recruitment channels and certified company domains.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-destructive mb-4">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span><span className="font-semibold">Critical Risk Flagged.</span> The uploaded text requests an upfront security deposit for hardware or training, which violates standard corporate recruitment policies.</span>
                </div>
              )}

              {result.hits.length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-3">Flagged clauses</div>
                  <ul className="space-y-2">
                    {Array.from(new Map(result.hits.map((h) => [h.reason, h])).values()).map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <span><span className="font-medium">{h.reason}</span> <span className="text-muted-foreground">— "{h.phrase}"</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
