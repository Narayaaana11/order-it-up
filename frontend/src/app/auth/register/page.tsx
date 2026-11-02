import Link from 'next/link';
import { ArrowLeft, ArrowRight, ClipboardCheck, MailCheck } from 'lucide-react';

const PILOT_ACCESS_URL = process.env.NEXT_PUBLIC_OIU_PILOT_ACCESS_URL || 'https://orderitup.in/request-access';

export default function PilotAccessRequiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400"><ClipboardCheck className="h-7 w-7" /></div>
        <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.18em] text-orange-400">Order It Up restaurant pilot</p>
        <h1 className="mt-2 text-center text-2xl font-extrabold sm:text-3xl">Request access for your restaurant</h1>
        <p className="mt-4 text-center text-sm leading-6 text-slate-300">New restaurant accounts are created after a pilot request is reviewed. Once approved, the pilot team sends a one-time setup link so you can create your password.</p>
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-start gap-3"><MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /><p className="text-sm leading-6 text-slate-300">Already approved? Open the setup link from the pilot team. If it expired or was already used, contact the team to request a replacement.</p></div>
        </div>
        <a href={PILOT_ACCESS_URL} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-700">Request Pilot Access <ArrowRight className="h-4 w-4" /></a>
        <Link href="/auth/login" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
      </section>
    </main>
  );
}
