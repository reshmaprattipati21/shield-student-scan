import { Shield } from "lucide-react";

export function RadarRing({ size = 120, label }: { size?: number; label?: string }) {
  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <div className="radar-ring absolute inset-0" />
      <div
        className="absolute rounded-full border border-cyan-400/30"
        style={{ inset: size * 0.18, animation: "spinSlow 6s linear infinite" }}
      />
      <div
        className="absolute rounded-full border border-cyan-400/20"
        style={{ inset: size * 0.32, animation: "spinReverse 9s linear infinite" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/40 shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--cyber-cyan)_60%,transparent)]">
          <Shield className="h-5 w-5" />
        </div>
      </div>
      {label && (
        <div className="absolute -bottom-6 left-0 right-0 text-center text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
          {label}
        </div>
      )}
    </div>
  );
}
