import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UniGuide — your AI co-pilot for university paperwork",
  description:
    "AI-driven workflow assistant that guides UM students through complex multi-step administrative procedures with adaptive decision-making. Built for UMHackathon 2026.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
