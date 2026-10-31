"use client";

import React, { useState } from "react";
import {
  X,
  Key,
  Copy,
  Check,
  UserCheck,
  Shield,
  ChefHat,
  Receipt,
  User,
  Coffee,
  Sparkles,
} from "lucide-react";
import { DEMO_USERS, setStoredUser, AuthUser } from "@/lib/auth";

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole?: (user: AuthUser) => void;
}

export default function CredentialsModal({
  isOpen,
  onClose,
  onSelectRole,
}: CredentialsModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handle1ClickLogin = (user: AuthUser) => {
    setStoredUser(user);
    if (onSelectRole) onSelectRole(user);
    onClose();
  };

  const roleList = [
    {
      key: "superadmin",
      label: "Super Admin",
      roleCode: "SUPER_ADMIN",
      desc: "Platform administration & global system configuration",
      icon: Shield,
      color: "from-purple-500 to-indigo-600",
      ...DEMO_USERS.superadmin,
    },
    {
      key: "owner",
      label: "Restaurant Owner",
      roleCode: "owner",
      desc: "Full business P&L analytics, tax rates & store ownership",
      icon: Sparkles,
      color: "from-orange-500 to-amber-500",
      ...DEMO_USERS.owner,
    },
    {
      key: "manager",
      label: "Store Manager",
      roleCode: "manager",
      desc: "Day shifts, inventory adjustments & cashier audits",
      icon: UserCheck,
      color: "from-blue-500 to-cyan-600",
      ...DEMO_USERS.manager,
    },
    {
      key: "accountant",
      label: "Accountant",
      roleCode: "accountant",
      desc: "GST/VAT tax filings, Z-Report cash ledgers & Tally export",
      icon: Receipt,
      color: "from-emerald-500 to-teal-600",
      ...DEMO_USERS.accountant,
    },
    {
      key: "cashier",
      label: "POS Cashier",
      roleCode: "cashier",
      desc: "Sub-second order punching, UPI QR & 24V drawer pulse",
      icon: Coffee,
      color: "from-amber-500 to-yellow-600",
      ...DEMO_USERS.cashier,
    },
    {
      key: "server",
      label: "Server / Captain",
      roleCode: "server",
      desc: "Table dine-in ordering on mobile (:3003) & KOT routing",
      icon: User,
      color: "from-rose-500 to-pink-600",
      ...DEMO_USERS.server,
    },
    {
      key: "chef",
      label: "Kitchen Chef",
      roleCode: "chef",
      desc: "Real-time live KDS kitchen display (:3002) & ticket bumping",
      icon: ChefHat,
      color: "from-red-500 to-orange-600",
      ...DEMO_USERS.chef,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-orange-200 shadow-xs">
              <Key className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Official Operational Roles &amp; Test Credentials
              </h3>
              <p className="text-xs text-slate-600">
                Pre-configured sandbox accounts for testing all restaurant roles
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-600">
            Click <strong>&quot;1-Click Sign In&quot;</strong> on any role below to instantly authenticate and unlock the desktop download, or copy the credentials to test login manually.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {roleList.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-lg bg-gradient-to-br ${item.color} text-white shadow-xs`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">{item.label}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono text-slate-600">
                        {item.roleCode}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 mb-3">{item.desc}</p>

                    <div className="space-y-1.5 font-mono text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-[10px] text-slate-600 uppercase font-semibold">
                          Email:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[180px]">{item.email}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.email, `email_${item.key}`)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800"
                            title="Copy email"
                          >
                            {copiedKey === `email_${item.key}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-[10px] text-slate-600 uppercase font-semibold">
                          Password:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{item.pass}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.pass, `pass_${item.key}`)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800"
                            title="Copy password"
                          >
                            {copiedKey === `pass_${item.key}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 truncate max-w-[150px]">
                      {item.user.organizationName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handle1ClickLogin(item.user)}
                      className="px-3 py-1.5 rounded-lg bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs shadow-xs active:scale-[0.98] transition-all"
                    >
                      1-Click Sign In
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

