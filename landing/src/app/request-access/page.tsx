import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ModalProvider from "@/components/ModalProvider";
import PilotAccessForm from "@/components/PilotAccessForm";

export const metadata: Metadata = {
  title: "Request Pilot Access | Order It Up",
  description: "Tell us about your restaurant and the workflows you would like to evaluate with the Order It Up pilot.",
};

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ModalProvider />
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <p className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-700">Early-access restaurant pilot</p>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Request pilot access</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Share a few details about your restaurant. Our team will review your workflows and contact you about fit, supported setup, and next steps.</p>
        </div>
        <div className="mx-auto max-w-3xl"><PilotAccessForm /></div>
      </main>
      <Footer />
    </div>
  );
}
