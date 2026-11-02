"use client";

import React from "react";
import { X, Sparkles, UserCheck, Receipt, Coffee, User, ChefHat } from "lucide-react";
import { DEMO_USERS, setDemoPreviewUser, type AuthUser } from "@/lib/auth";

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole?: (user: AuthUser) => void;
}

const ROLE_PRESENTATION = [
  { key: "owner", label: "Restaurant Owner", description: "Sample owner dashboard", icon: Sparkles },
  { key: "manager", label: "Store Manager", description: "Sample manager view", icon: UserCheck },
  { key: "accountant", label: "Accountant", description: "Sample finance view", icon: Receipt },
  { key: "cashier", label: "POS Cashier", description: "Sample counter view", icon: Coffee },
  { key: "server", label: "Server / Captain", description: "Sample floor-service view", icon: User },
  { key: "chef", label: "Kitchen Chef", description: "Sample kitchen view", icon: ChefHat },
] as const;

export default function CredentialsModal({ isOpen, onClose, onSelectRole }: CredentialsModalProps) {
  if (!isOpen) return null;

  const openPreview = (key: keyof typeof DEMO_USERS) => {
    const user = DEMO_USERS[key].user;
    setDemoPreviewUser(user);
    onSelectRole?.(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" role="dialog" aria-modal="true">
        <div className="p-5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-b border-orange-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Sample dashboard previews</h3>
            <p className="text-xs text-slate-600 mt-1">Preview-only profiles. No account or API access is created.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700" aria-label="Close preview dialog">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Demo preview uses temporary browser session data only. It does not issue a JWT, authenticate against the Cloud API, or grant access to restaurant data. Do not enter real business or customer information.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLE_PRESENTATION.map((role) => {
              const Icon = role.icon;
              return (
                <div key={role.key} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-700"><Icon className="w-4 h-4" /></div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{role.label}</div>
                      <div className="text-xs text-slate-500">{role.description}</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => openPreview(role.key)} className="shrink-0 px-3 py-2 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800">
                    Preview
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800">Close</button>
        </div>
      </div>
    </div>
  );
}
