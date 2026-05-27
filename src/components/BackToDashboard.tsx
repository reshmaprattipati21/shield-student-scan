import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackToDashboard({ label = "Dashboard" }: { label?: string }) {
  return (
    <Link
      to="/"
      aria-label="Back to dashboard"
      className="group absolute top-4 left-4 sm:top-6 sm:left-6 z-30 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-primary backdrop-blur-md transition-all duration-300 ease-out hover:-translate-x-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      style={{
        background: "linear-gradient(160deg, rgba(19,28,46,0.7), rgba(11,15,25,0.55))",
        borderColor: "color-mix(in oklab, var(--cyber-cyan) 35%, transparent)",
        boxShadow:
          "0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 15%, transparent), 0 8px 24px -10px color-mix(in oklab, var(--cyber-cyan) 55%, transparent)",
      }}
    >
      <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5 drop-shadow-[0_0_6px_color-mix(in_oklab,var(--cyber-cyan)_70%,transparent)]" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
