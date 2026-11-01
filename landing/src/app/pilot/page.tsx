import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PilotAccessForm from "@/components/PilotAccessForm";

export const metadata: Metadata = {
  title: "Request Pilot Access | Order It Up",
  description: "Tell the Order It Up team about your restaurant, POS and hardware setup to request an early-access pilot discussion.",
  alternates: { canonical: "/pilot/" },
};

export default function PilotPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Navbar />
      <main>
        <PilotAccessForm />
      </main>
      <Footer />
    </div>
  );
}
