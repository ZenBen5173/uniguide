"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

export default function DeadlineEditor({
  procedureId,
  initialDate,
  initialLabel,
}: {
  procedureId: string;
  initialDate: string | null;
  initialLabel: string | null;
}) {
  const [date, setDate] = useState(initialDate ? initialDate.slice(0, 10) : "");
  const [label, setLabel] = useState(initialLabel ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const r = await fetch(`/api/admin/procedures/${procedureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadline_date: date ? new Date(date + "T23:59:59+08:00").toISOString() : null,
          deadline_label: label.trim() || null,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ug-card p-4">
      <div className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Calendar className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.85} />
        Deadline
      </div>
      <div className="space-y-2.5">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">Cutoff date (optional)</span>
          <input
            type="date"
            className="ug-input mt-1.5"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">Display label</span>
          <input
            type="text"
            className="ug-input mt-1.5"
            placeholder='e.g. "Within 14 days of CGPA release"'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <span className="text-[11px] text-ink-4 mt-1 block leading-snug">
            Shown to students. If a date is set, students see "X days left" automatically.
          </span>
        </label>
        <div className="flex items-center justify-end gap-2 pt-1">
          {saved && <span className="text-[12px] text-moss font-medium">Saved</span>}
          <button className="ug-btn primary sm" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
