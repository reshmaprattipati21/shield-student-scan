import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScanHistoryPanel } from "@/components/ScanHistoryPanel";

export function ScanHistoryDrawer({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(440px,100vw)] sm:max-w-[440px] border-l border-[color-mix(in_oklab,var(--cyber-cyan)_30%,transparent)] bg-[#0B1220] p-5 overflow-y-auto"
      >
        <SheetHeader className="mb-4 text-left">
          <SheetTitle className="text-foreground">Your Unified Scan History</SheetTitle>
          <SheetDescription>
            Every URL, message, and PDF you've checked across ScamShield.
          </SheetDescription>
        </SheetHeader>
        <ScanHistoryPanel />
      </SheetContent>
    </Sheet>
  );
}
