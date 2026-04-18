/**
 * Generate a minimal .ics calendar file from a list of deadlines.
 *
 * No external dependency — produces a valid VCALENDAR string per RFC 5545.
 */

export interface CalendarDeadline {
  uid: string;
  title: string;
  description?: string;
  dueDate: Date;
}

function toIcsDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function generateIcs(deadlines: CalendarDeadline[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UniGuide//UMHackathon2026//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const d of deadlines) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.uid}@uniguide.app`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(d.dueDate)}`,
      `DTEND:${toIcsDate(d.dueDate)}`,
      `SUMMARY:${escapeText(d.title)}`,
      d.description ? `DESCRIPTION:${escapeText(d.description)}` : "",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}
