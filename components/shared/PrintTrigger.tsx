"use client";

import { Printer } from "lucide-react";

export default function PrintTrigger() {
  return (
    <button
      onClick={() => window.print()}
      className="ug-btn primary inline-flex items-center gap-2"
    >
      <Printer className="h-4 w-4" strokeWidth={1.85} />
      Print / Save as PDF
    </button>
  );
}
