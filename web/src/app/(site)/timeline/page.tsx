import type { Metadata } from "next";
import TimelineClient from "./TimelineClient";

export const metadata: Metadata = {
  title: "Activity Timeline | BlazeResolver",
  description:
    "Live Git commit history, triage events, releases, and development activity timeline for BlazeResolver.",
};

export default function TimelinePage() {
  return (
    <div className="h-screen max-h-screen w-full flex flex-col overflow-hidden bg-[#f9fafb] text-slate-900">
      <TimelineClient />
    </div>
  );
}
