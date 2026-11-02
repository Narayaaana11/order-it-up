
import Image from "next/image";
import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "Dashboard sandbox", href: "/dashboard" },
  { label: "Platform admin", href: "/dashboard?perspective=founder" },
  { label: "Request pilot access", href: "/request-access" },
  { label: "Counter POS Billing", href: "/#features" },
  { label: "Kitchen Display System", href: "/#ui-preview" },
  { label: "Mobile Waiter Workflow", href: "/#roles" },
];

const PILOT_CAPABILITIES = [
  "Restaurant POS and order billing",
  "Kitchen Display System (KDS)",
  "Mobile waiter workflows",
  "ESC/POS thermal printer support",
  "Cash-drawer triggering on compatible hardware",
  "GST, VAT and Tally export tools in the pilot build",
];

const POLICY_LINKS = [
  // Update these paths if your legal pages use different routes.
  { label: "Terms & Conditions", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Pilot & Beta Disclaimer", href: "/legal/pilot-disclaimer" },
  { label: "Tax & Reporting Notice", href: "/legal/tax-reporting" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-neutral-800 bg-[#090909] text-neutral-300">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(249,115,22,0.09),transparent_45%)]" />

      <div className="relative mx-auto max-w-7xl px-5 pb-8 pt-14 sm:px-8 lg:px-10">
        {/* Main footer columns */}
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10">

          {/* Brand and pilot information */}
          <div className="max-w-md">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Order It Up"
                width={42}
                height={42}
                className="h-10 w-10 rounded-xl object-contain"
              />

              <span className="text-xl font-bold tracking-tight text-white">
                Order It Up
              </span>
            </Link>

            <p className="mt-5 text-sm leading-7 text-neutral-400">
              An offline-first restaurant operations platform designed to
              support essential billing and service workflows when internet
              connectivity is unreliable.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              <span className="text-xs font-semibold tracking-wide text-orange-300">
                EARLY-ACCESS PILOT
              </span>
            </div>

            <p className="mt-4 text-xs leading-6 text-neutral-500">
              Currently being evaluated with pilot users. Features, supported
              devices and workflows may change as we gather feedback.
            </p>
            <a
              href="/request-access"
              className="mt-4 inline-flex text-sm font-semibold text-orange-400 transition-colors hover:text-orange-300"
            >
              Contact the pilot team →
            </a>
          </div>

          {/* Product navigation */}
          <div>
            <h3 className="text-sm font-semibold text-white">
              Explore Product
            </h3>

            <ul className="mt-5 space-y-3">
              {PRODUCT_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-400 transition-colors hover:text-orange-400"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Pilot capabilities */}
          <div>
            <h3 className="text-sm font-semibold text-white">
              Pilot Capabilities
            </h3>

            <ul className="mt-5 space-y-3">
              {PILOT_CAPABILITIES.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm leading-6 text-neutral-400"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal and policies */}
          <div>
            <h3 className="text-sm font-semibold text-white">
              Policies & Information
            </h3>

            <ul className="mt-5 space-y-3">
              {POLICY_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-400 transition-colors hover:text-orange-400"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs leading-6 text-neutral-500">
              Tax calculations, reports and exports are supporting tools.
              Please verify outputs against applicable requirements before
              using them for statutory or financial decisions.
            </p>
          </div>
        </div>

        {/* Pilot-stage disclosure */}
        <div className="mt-14 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 sm:p-6">
          <p className="text-sm font-semibold text-white">
            About the Order It Up pilot
          </p>

          <p className="mt-2 max-w-5xl text-xs leading-6 text-neutral-400 sm:text-sm">
            Order It Up is an early-stage software product currently being
            developed and tested by its founders. It is in a pre-registration
            pilot stage and is not yet being presented as a fully launched
            commercial service. Product direction, formal business
            registration and any wider commercial rollout will be considered
            after pilot feedback and market validation.
          </p>

          <p className="mt-3 max-w-5xl text-xs leading-6 text-neutral-500">
            During testing, users should retain their own backups and
            independently verify important transactions, reports, tax
            information and hardware compatibility. Pilot access does not
            constitute a service-level or uninterrupted-availability
            guarantee.
          </p>
        </div>

        {/* Copyright and bottom links */}
        <div className="mt-8 flex flex-col gap-4 border-t border-neutral-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-neutral-500">
            © {new Date().getFullYear()} Order It Up. All rights reserved.
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/legal/terms"
              className="text-xs text-neutral-500 transition-colors hover:text-orange-400"
            >
              Terms
            </Link>

            <Link
              href="/legal/privacy"
              className="text-xs text-neutral-500 transition-colors hover:text-orange-400"
            >
              Privacy
            </Link>

            <Link
              href="/legal/pilot-disclaimer"
              className="text-xs text-neutral-500 transition-colors hover:text-orange-400"
            >
              Pilot Disclaimer
            </Link>

            <Link
              href="/#top"
              className="text-xs text-neutral-500 transition-colors hover:text-orange-400"
            >
              Back to Top ↑
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
