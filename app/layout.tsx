import type { Metadata } from "next";
import "./globals.css";
import DemoModeBanner from "@/components/shared/DemoModeBanner";
import SponsorFooter from "@/components/shared/SponsorFooter";

export const metadata: Metadata = {
  title: "UniGuide — your AI co-pilot for university paperwork",
  description:
    "AI-driven workflow assistant that guides UM students through complex multi-step administrative procedures with adaptive decision-making. Built for UMHackathon 2026.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
        <DemoModeBanner />
        <div className="flex-1 flex flex-col">{children}</div>
        <SponsorFooter />
      </body>
    </html>
  );
}
