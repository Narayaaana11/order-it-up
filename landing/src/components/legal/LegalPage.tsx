import Link from "next/link";
import type { ReactNode } from "react";
import { legalConfig } from "@/lib/legal-config";

type LegalPageProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalPage({ title, description, children }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#090909] text-neutral-200">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-10 border-b border-neutral-800 pb-8">
          <Link href="/" className="text-sm font-semibold text-orange-400 hover:text-orange-300">
            ← Order It Up
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
            Pilot-stage product information
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-400 sm:text-base">
            {description}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-500">
            <span>Effective: {legalConfig.effectiveDate}</span>
            <span>Last updated: {legalConfig.lastUpdated}</span>
          </div>
        </div>

        <article className="legal-content space-y-8 text-sm leading-7 text-neutral-300 sm:text-[15px]">
          {children}
        </article>

        <div className="mt-14 border-t border-neutral-800 pt-7 text-xs leading-6 text-neutral-500">
          <p className="font-semibold text-neutral-300">Operator details</p>
          <p className="mt-2">{legalConfig.operatorLegalName}</p>
          {legalConfig.correspondenceAddress ? <p>{legalConfig.correspondenceAddress}</p> : null}
          <p>Legal and privacy contact: {legalConfig.legalEmail}</p>
          <p>Support: {legalConfig.supportEmail}</p>
          {legalConfig.phone ? <p>Phone: {legalConfig.phone}</p> : null}
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
            <Link className="hover:text-orange-400" href="/legal/terms">Terms</Link>
            <Link className="hover:text-orange-400" href="/legal/privacy">Privacy</Link>
            <Link className="hover:text-orange-400" href="/legal/pilot-disclaimer">Pilot disclaimer</Link>
            <Link className="hover:text-orange-400" href="/legal/tax-reporting">Tax & reporting</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 list-disc space-y-2 marker:text-orange-400">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}
