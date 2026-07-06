import { useMemo } from "react";

function seededCols(seed: number) {
  // Deterministic pseudo-random generator (mulberry32)
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: 24 }, (_, i) => {
    const left = (i / 24) * 100 + rand() * 2;
    const dur = 14 + rand() * 18;
    const delay = -rand() * dur;
    const chars = Array.from({ length: 60 }, () => (rand() > 0.5 ? "1" : "0")).join("\n");
    return { left, dur, delay, chars, key: i };
  });
}

// Stable seed so SSR and client produce identical output (no hydration mismatch)
const SEED = 42;

export function CyberBg() {
  const cols = useMemo(() => seededCols(SEED), []);

  return (
    <>
      <div className="matrix-rain" aria-hidden="true" />
      <div className="binary-track" aria-hidden="true">
        {cols.map((c) => (
          <div
            key={c.key}
            className="col"
            style={{
              left: `${c.left}%`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
            }}
          >
            {c.chars}
          </div>
        ))}
      </div>
    </>
  );
}
