'use client';

import React, { useState } from 'react';
import {
  Users,
  Calculator,
  CreditCard,
  Flame,
  CheckCircle2,
  Lock,
  Smartphone,
  Sliders,
} from 'lucide-react';

interface RoleData {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ElementType;
  color: string;
  accentBg: string;
  responsibilities: string[];
  systemPermissions: string[];
  sampleQuote: string;
}

const ROLES: RoleData[] = [
  {
    id: 'owner',
    title: 'Restaurant Owner & Founder',
    subtitle: 'Strategic Multi-Outlet Visibility & Profitability',
    badge: 'Enterprise Access',
    icon: Users,
    color: 'text-orange-400',
    accentBg: 'bg-orange-500/10 border-orange-500/20',
    sampleQuote: '"I check today\'s multi-outlet turnover and top-moving dishes from my phone in 10 seconds."',
    responsibilities: [
      'Multi-branch gross sales comparison and franchise performance tracking.',
      'Central master menu catalog curation and price override management.',
      'Subscription, organization billing, and administrative security credentials.',
      'Global tax configuration (GST India, VAT, Sales Tax) and branch assignments.',
    ],
    systemPermissions: [
      'Full Organization Administration',
      'Branch Creation & Outlet Setup',
      'Master Catalog Authoring',
      'Global Financial Audit Exports',
    ],
  },
  {
    id: 'manager',
    title: 'Store & Shift Manager',
    subtitle: 'Shift Opening, Floor Orchestration & Cashier Float',
    badge: 'Store Operations',
    icon: Sliders,
    color: 'text-amber-400',
    accentBg: 'bg-amber-500/10 border-amber-500/20',
    sampleQuote: '"Opening shifts, declaring morning cash floats, and authorizing special discounts is friction-free."',
    responsibilities: [
      'Daily register opening float declarations and cashier handoff verification.',
      'Manager overrides for item voids, promotional discounts, and custom bills.',
      'Table layout design, floorplan seating zones, and reservation assignments.',
      'Staff shift attendance and employee role management.',
    ],
    systemPermissions: [
      'Shift Open & Close Approvals',
      'Discount & Void Authorization',
      'Table Floorplan Editor',
      'Outlet Inventory Balances',
    ],
  },
  {
    id: 'accountant',
    title: 'Finance & Compliance Accountant',
    subtitle: 'Cash Drawer Variance & Tally XML Accounting',
    badge: 'Fiscal Compliance',
    icon: Calculator,
    color: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10 border-emerald-500/20',
    sampleQuote: '"End-of-day register reconciliation matches expected vs physical cash with zero math errors."',
    responsibilities: [
      'Audit physical cash counts against system registers to spot cash drawer discrepancies.',
      'Export one-click Tally XML ledgers for direct import into standard accounting software.',
      'Generate statutory tax summaries (CGST, SGST, IGST, VAT) by fiscal period.',
      'Track petty cash expense vouchers and supplier purchase payouts.',
    ],
    systemPermissions: [
      'Cash Drawer Shift Reconciliations',
      'Tally XML Accounting Export',
      'GST / VAT Period Audits',
      'Expense Ledger Access',
    ],
  },
  {
    id: 'cashier',
    title: 'Front Counter Cashier',
    subtitle: 'High-Speed Checkout & Thermal Receipt Generation',
    badge: 'Checkout Speed',
    icon: CreditCard,
    color: 'text-sky-400',
    accentBg: 'bg-sky-500/10 border-sky-500/20',
    sampleQuote: '"Even during the lunch rush, punching orders and kicking open the cash drawer takes under 3 seconds."',
    responsibilities: [
      'Rapid touch billing with quick categories, item search, and barcode scanning.',
      'Split tender settlements across cash, cards, and UPI QR codes.',
      'Automatic cash drawer pulse upon cash payment confirmation.',
      'ESC/POS 80mm/58mm thermal receipt printing with itemized tax breakdown.',
    ],
    systemPermissions: [
      'Counter Bill Creation',
      'Payment Tender Collection',
      'Receipt Re-Printing',
      'Cash Drawer Pulse Kick',
    ],
  },
  {
    id: 'server',
    title: 'Waitstaff & Floor Captain',
    subtitle: 'Mobile Table-Side Ordering & Course Firing',
    badge: 'Mobile Companion',
    icon: Smartphone,
    color: 'text-indigo-400',
    accentBg: 'bg-indigo-500/10 border-indigo-500/20',
    sampleQuote: '"I take orders right at table 7, customize extra spicy notes, and the kitchen grill gets the ticket immediately."',
    responsibilities: [
      'Pair any smartphone or handheld terminal using a quick 6-digit cryptographic PIN.',
      'Input table-side orders with modifier preferences (spice level, allergen notes).',
      'Fire appetizer courses first, followed by main courses to the kitchen.',
      'Check real-time table dining status (vacant, dining, billed) across rooms.',
    ],
    systemPermissions: [
      'Table-Side Order Entry',
      'Kitchen Ticket Firing',
      'Item Modifier Selection',
      'Table State Inquiries',
    ],
  },
  {
    id: 'chef',
    title: 'Kitchen Executive Chef',
    subtitle: 'Station-Specific KDS Tickets & Prep Velocity',
    badge: 'Kitchen Engine',
    icon: Flame,
    color: 'text-rose-400',
    accentBg: 'bg-rose-500/10 border-rose-500/20',
    sampleQuote: '"No more soaked or misplaced paper tickets near the stove. My grill station displays only the dishes I cook."',
    responsibilities: [
      'View station-filtered tickets (Grill, Bar, Salad, Bakery) in high contrast.',
      'Monitor elapsed ticket preparation timers with color-coded warning thresholds.',
      'Tap to mark items or complete tickets ready for server runner pickup.',
      'Prevent missed courses during peak dining rushes.',
    ],
    systemPermissions: [
      'Station Ticket Viewing',
      'Item Preparation Status Update',
      'Ready Notification Broadcasting',
      'Completed Ticket Archiving',
    ],
  },
];

export default function MarketingRoleWorkflows() {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('owner');
  const activeRole = ROLES.find((r) => r.id === selectedRoleId) || ROLES[0];
  const ActiveRoleIcon = activeRole.icon;

  return (
    <section id="roles" className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
          <Users className="w-3.5 h-3.5 text-orange-400" />
          <span>Verified Role-Based Access Control</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Tailored Workflows for Every Restaurant Role
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-400">
          Order It Up enforces strict role separation. Each team member sees precisely what they need to execute their job with speed, security, and accountability.
        </p>
      </div>

      {/* Role Navigation Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-10">
        {ROLES.map((role) => {
          const isSelected = role.id === selectedRoleId;
          const RoleIcon = role.icon;
          return (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col items-center sm:items-start ${
                isSelected
                  ? 'bg-slate-900 border-orange-500/50 shadow-lg shadow-orange-500/10'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                  isSelected ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <RoleIcon className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-white text-center sm:text-left">
                {role.id === 'owner' ? 'Owner / Founder' :
                 role.id === 'manager' ? 'Store Manager' :
                 role.id === 'accountant' ? 'Accountant' :
                 role.id === 'cashier' ? 'Cashier' :
                 role.id === 'server' ? 'Server / Waiter' :
                 'Kitchen Chef'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
                {role.badge}
              </div>
            </button>
          );
        })}
      </div>

      {/* Role Detail Spotlight Card */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Responsibilities */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-lg ${activeRole.accentBg} flex items-center justify-center ${activeRole.color}`}>
                  <ActiveRoleIcon className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${activeRole.accentBg} ${activeRole.color}`}
                >
                  {activeRole.badge}
                </span>
                <span className="text-xs font-mono text-slate-400">Authenticated Role Node</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {activeRole.title}
              </h3>
              <p className="text-sm font-medium text-slate-400 mt-1">
                {activeRole.subtitle}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 italic text-xs sm:text-sm text-slate-300">
              {activeRole.sampleQuote}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Key Day-to-Day Responsibilities
              </h4>
              <ul className="space-y-2.5">
                {activeRole.responsibilities.map((resp, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Enforced Permissions & Security Guardrails */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <Lock className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Enforced RBAC Permissions
              </span>
            </div>

            <div className="space-y-2">
              {activeRole.systemPermissions.map((perm, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs"
                >
                  <span className="text-slate-300 font-medium">{perm}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    Granted
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80">
              Security Note: Passwords and PINs are verified through server-side authorization tokens with cryptographic tamper protection.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
