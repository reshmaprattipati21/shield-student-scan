import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackToDashboard({ label = "Dashboard" }: { label?: string }) {
  return (
    <Link
      to="/"
      aria-label="Back to dashboard"
      className="group absolute top-4 left-4 sm:top-6 sm:left-6 z-50 inline-flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold backdrop-blur-md transition-all duration-200 ease-out hover:-translate-x-1 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]/70"
      style={{
        color: "#00F0FF",
        background: "linear-gradient(160deg, rgba(19,28,46,0.85), rgba(11,15,25,0.7))",
        borderColor: "rgba(0,240,255,0.6)",
        boxShadow:
          "0 0 0 1px rgba(0,240,255,0.25), 0 0 18px rgba(0,240,255,0.45), 0 8px 24px -10px rgba(0,240,255,0.6)",
        textShadow: "0 0 8px rgba(0,240,255,0.7)",
      }}
    >
      <ArrowLeft
        className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5"
        style={{ filter: "drop-shadow(0 0 8px rgba(0,240,255,0.85))" }}
      />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
