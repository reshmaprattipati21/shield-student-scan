export function CyberBg() {
  // Faint binary column tracks — purely decorative, opacity 0.03
  const cols = Array.from({ length: 24 }, (_, i) => {
    const left = (i / 24) * 100 + Math.random() * 2;
    const dur = 14 + Math.random() * 18;
    const delay = -Math.random() * dur;
    const chars = Array.from({ length: 60 }, () => (Math.random() > 0.5 ? "1" : "0")).join("\n");
    return { left, dur, delay, chars, key: i };
  });
  return (
    <>
      <div className="matrix-rain" aria-hidden="true" />
      <div className="binary-track" aria-hidden="true">
        {cols.map((c) => (
          <div
            key={c.key}
            className="col"
            style={{ left: `${c.left}%`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
          >
            {c.chars}
          </div>
        ))}
      </div>
    </>
  );
}
