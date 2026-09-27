import type { Metadata } from "next";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "Admin Support Desk | BlazeResolver",
  description:
    "Unified AI triage, policy auto-resolution, live human handoff, and diagnostic audit desk.",
};

export default function AdminPage() {
  return (
    <div className="h-screen max-h-screen w-full flex flex-col overflow-hidden bg-[#ffffff] text-slate-900">
      <AdminClient />
    </div>
  );
}
