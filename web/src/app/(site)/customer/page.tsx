import type { Metadata } from "next";
import CustomerClient from "./CustomerClient";

export const metadata: Metadata = {
  title: "Customer Support Portal | BlazeResolver",
  description:
    "Self-service customer support, issue tracking, and live AI resolution with BlazeResolver.",
};

export default function CustomerPage() {
  return (
    <div className="h-screen max-h-screen w-full flex flex-col overflow-hidden bg-[#f9fafb] text-slate-900">
      <CustomerClient />
    </div>
  );
}
