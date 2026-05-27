import { useEffect, useState } from "react";

type Risk = "Low" | "Medium" | "High";

export function RiskGauge({ score, risk }: { score: number; risk: Risk }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(score * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  // Semi-circle SVG gauge (180deg arc)
  const r = 90;
  const cx = 110, cy = 110;
  const circ = Math.PI * r; // half circumference
  const offset = circ * (1 - animated / 100);

  const colors = {
    Low:    { stroke: "#10B981", glow: "rgba(16,185,129,.6)", label: "SAFE", glowClass: "text-glow-green" },
    Medium: { stroke: "#F59E0B", glow: "rgba(245,158,11,.6)", label: "CAUTION", glowClass: "text-glow-amber" },
    High:   { stroke: "#EF4444", glow: "rgba(239,68,68,.65)", label: "HIGH RISK", glowClass: "text-glow-red" },
  } as const;
  const c = colors[risk];

  // Needle angle 0..180deg mapped from 0..100
  const angle = -90 + (animated / 100) * 180;

  return (
    <div className="relative mx-auto" style={{ width: 220, height: 140 }}>
      <svg viewBox="0 0 220 130" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="riskGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <filter id="gaugeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Background track */}
        <path
          d={`M 20 110 A ${r} ${r} 0 0 1 200 110`}
          fill="none"
          stroke="rgba(148,163,184,0.18)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Animated risk arc */}
        <path
          d={`M 20 110 A ${r} ${r} 0 0 1 200 110`}
          fill="none"
          stroke="url(#riskGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)", filter: "url(#gaugeGlow)" }}
        />
        {/* Tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = (-180 + (i * 18)) * (Math.PI / 180);
          const r1 = r + 12, r2 = r + 20;
          const x1 = cx + Math.cos(a) * r1;
          const y1 = cy + Math.sin(a) * r1;
          const x2 = cx + Math.cos(a) * r2;
          const y2 = cy + Math.sin(a) * r2;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(34,211,238,.35)" strokeWidth="1.5" />;
        })}
        {/* Needle */}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 1.1s cubic-bezier(.2,.8,.2,1)" }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} stroke={c.stroke} strokeWidth="3" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }} />
          <circle cx={cx} cy={cy} r="6" fill={c.stroke} style={{ filter: `drop-shadow(0 0 8px ${c.glow})` }} />
        </g>
      </svg>
      <div className="-mt-2 text-center">
        <div className={`text-4xl font-bold tabular-nums ${c.glowClass}`}>{Math.round(animated)}</div>
        <div className={`text-xs font-semibold tracking-[0.28em] mt-1 ${c.glowClass} ${risk === "High" ? "animate-pulse" : ""}`}>{c.label}</div>
      </div>
    </div>
  );
}
