"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, FileText, MessageSquare, Plus, X } from "lucide-react";

interface Event {
  type: "status_change" | "letter" | "decision" | "new_submission" | "info_request";
  title: string;
  subtitle: string | null;
  href: string;
  ts: string;
  app_id: string;
}

const READ_KEY = "uniguide:notifications:last_read_at";
const POLL_MS = 45_000;

export default function NotificationBell() {
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState(false);
  const [lastRead, setLastRead] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(READ_KEY);
    setLastRead(raw ? parseInt(raw) : 0);
  }, []);

  const load = async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const j = await r.json();
      if (j.ok) setEvents(j.data.events);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = events.filter((e) => new Date(e.ts).getTime() > lastRead).length;

  const markRead = () => {
    const now = Date.now();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(READ_KEY, String(now));
    }
    setLastRead(now);
  };

  const toggleOpen = () => {
    if (!open) {
      setOpen(true);
      // Defer markRead so the user sees the dot transition before it clears.
      setTimeout(markRead, 600);
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        className="relative grid place-items-center w-8 h-8 rounded-md hover:bg-paper-2 text-ink-3 hover:text-ink"
        aria-label="Notifications"
        title={unread > 0 ? `${unread} new` : "Notifications"}
      >
        <Bell className="h-[15px] w-[15px]" strokeWidth={1.85} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 grid place-items-center rounded-full bg-crimson text-white text-[9px] font-bold mono leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] overflow-y-auto rounded-[12px] border border-line-2 bg-card shadow-ug-lift z-50">
          <div className="px-4 py-3 border-b border-line-2 flex items-center justify-between">
            <div className="text-[13.5px] font-semibold text-ink">Notifications</div>
            <span className="text-[11px] text-ink-4 mono">last 14 days</span>
          </div>

          {events.length === 0 ? (
            <div className="px-4 py-8 text-center text-ink-4 text-[13px]">
              Nothing yet. Application updates will appear here.
            </div>
          ) : (
            <div className="divide-y divide-line-2">
              {events.map((e, i) => {
                const isUnread = new Date(e.ts).getTime() > lastRead;
                const Icon = ICON_BY_TYPE[e.type];
                return (
                  <Link
                    key={i}
                    href={e.href}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-paper-2 no-underline text-ink-2 ${isUnread ? "bg-ai-tint/30" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`grid place-items-center w-7 h-7 rounded-md flex-shrink-0 ${TONE_BY_TYPE[e.type]}`}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink leading-tight">{e.title}</div>
                        {e.subtitle && (
                          <div className="text-[11.5px] text-ink-4 mt-0.5 truncate">{e.subtitle}</div>
                        )}
                        <div className="text-[10.5px] text-ink-4 mono mt-1">{relTime(e.ts)}</div>
                      </div>
                      {isUnread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-crimson mt-1.5 flex-shrink-0" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ICON_BY_TYPE = {
  status_change: FileText,
  letter: FileText,
  decision: Check,
  new_submission: Plus,
  info_request: MessageSquare,
} as const;

const TONE_BY_TYPE: Record<Event["type"], string> = {
  status_change: "bg-paper-2 text-ink-3 border border-line-2",
  letter: "bg-ai-tint text-ai-ink border border-ai-line",
  decision: "bg-moss-soft text-moss border border-[#CFDDCF]",
  new_submission: "bg-amber-soft text-amber border border-[#E8DBB5]",
  info_request: "bg-crimson-soft text-crimson border border-[#E8C5CB]",
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
