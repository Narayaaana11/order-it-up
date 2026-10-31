"use client";

import React, { useState, useEffect } from "react";
import AuthModal from "@/components/AuthModal";
import BillTemplateModal from "@/components/BillTemplateModal";
import TermsModal from "@/components/TermsModal";
import CredentialsModal from "@/components/CredentialsModal";
import { AuthMode, DownloadPlatform, BillFormat, LegalTab } from "@/lib/modalEvents";
import { CheckCircle2, Download, X } from "lucide-react";

export default function ModalProvider() {
  // Auth Modal State
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [pendingDownloadPlatform, setPendingDownloadPlatform] = useState<DownloadPlatform>(null);

  // Bill Modal State
  const [billOpen, setBillOpen] = useState(false);
  const [billFormat, setBillFormat] = useState<BillFormat>("standard");

  // Legal / Terms Modal State
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsTab, setTermsTab] = useState<LegalTab>("terms");

  // Credentials Modal State
  const [credentialsOpen, setCredentialsOpen] = useState(false);

  // Active Download Toast State
  const [downloadToast, setDownloadToast] = useState<{
    show: boolean;
    platform: string;
    filename: string;
  }>({
    show: false,
    platform: "",
    filename: "",
  });

  const triggerFileDownload = (platform: DownloadPlatform) => {
    let filename = "OrderItUp-POS-Setup-1.2.0.exe";
    let platformLabel = "Windows (x64)";
    if (platform === "mac") {
      filename = "OrderItUp-POS-1.2.0-universal.dmg";
      platformLabel = "macOS (Apple Silicon & Intel)";
    } else if (platform === "linux") {
      filename = "OrderItUp-POS-1.2.0.AppImage";
      platformLabel = "Linux (Universal)";
    }

    setDownloadToast({
      show: true,
      platform: platformLabel,
      filename,
    });

    // Create a mock download trigger
    try {
      const blob = new Blob(
        [
          `Order It Up Desktop POS v1.2.0\n` +
          `Platform: ${platformLabel}\n` +
          `Engine: Standalone Electron + Express (:3001) + SQLite WAL\n` +
          `Zero Cloud Lock-in • Offline Durability Guaranteed\n` +
          `Visit: https://orderitup.pages.dev/ for documentation.`
        ],
        { type: "text/plain;charset=utf-8" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback
    }

    setTimeout(() => {
      setDownloadToast((prev) => ({ ...prev, show: false }));
    }, 6000);
  };

  useEffect(() => {
    const handleOpenAuth = (e: Event) => {
      const custom = e as CustomEvent<{
        mode?: AuthMode;
        downloadPendingPlatform?: DownloadPlatform;
      }>;
      if (custom.detail?.mode) setAuthMode(custom.detail.mode);
      setPendingDownloadPlatform(custom.detail?.downloadPendingPlatform || null);
      setAuthOpen(true);
    };

    const handleOpenBill = (e: Event) => {
      const custom = e as CustomEvent<{ format?: BillFormat }>;
      if (custom.detail?.format) setBillFormat(custom.detail.format);
      setBillOpen(true);
    };

    const handleOpenTerms = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: LegalTab }>;
      if (custom.detail?.tab) setTermsTab(custom.detail.tab);
      else setTermsTab("terms");
      setTermsOpen(true);
    };

    const handleOpenLicense = () => {
      setTermsTab("terms");
      setTermsOpen(true);
    };

    const handleOpenCredentials = () => {
      setCredentialsOpen(true);
    };

    window.addEventListener("orderitup_open_auth_modal", handleOpenAuth);
    window.addEventListener("orderitup_open_bill_modal", handleOpenBill);
    window.addEventListener("orderitup_open_terms_modal", handleOpenTerms);
    window.addEventListener("orderitup_open_license_modal", handleOpenLicense);
    window.addEventListener("orderitup_open_credentials_modal", handleOpenCredentials);

    return () => {
      window.removeEventListener("orderitup_open_auth_modal", handleOpenAuth);
      window.removeEventListener("orderitup_open_bill_modal", handleOpenBill);
      window.removeEventListener("orderitup_open_terms_modal", handleOpenTerms);
      window.removeEventListener("orderitup_open_license_modal", handleOpenLicense);
      window.removeEventListener("orderitup_open_credentials_modal", handleOpenCredentials);
    };
  }, []);

  const handleAuthSuccess = () => {
    if (pendingDownloadPlatform) {
      triggerFileDownload(pendingDownloadPlatform);
      setPendingDownloadPlatform(null);
    }
  };

  return (
    <>
      <AuthModal
        isOpen={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingDownloadPlatform(null);
        }}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
        downloadPendingPlatform={pendingDownloadPlatform}
      />

      <BillTemplateModal
        isOpen={billOpen}
        onClose={() => setBillOpen(false)}
        initialFormat={billFormat}
      />

      <TermsModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        initialTab={termsTab}
      />

      <CredentialsModal
        isOpen={credentialsOpen}
        onClose={() => setCredentialsOpen(false)}
        onSelectRole={handleAuthSuccess}
      />

      {/* Download Progress Banner / Toast */}
      {downloadToast.show && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Download className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Authorized Download Starting</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {downloadToast.filename} ({downloadToast.platform})
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                Offline Desktop POS • Embedded SQLite WAL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDownloadToast((prev) => ({ ...prev, show: false }))}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
