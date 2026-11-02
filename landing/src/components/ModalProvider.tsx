"use client";

import React, { useEffect, useState } from "react";
import BillTemplateModal from "@/components/BillTemplateModal";
import CredentialsModal from "@/components/CredentialsModal";
import AuthModal from "@/components/AuthModal";
import type { AuthMode, BillFormat, DownloadPlatform } from "@/lib/modalEvents";

export default function ModalProvider() {
  const [billOpen, setBillOpen] = useState(false);
  const [billFormat, setBillFormat] = useState<BillFormat>("standard");
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [downloadPendingPlatform, setDownloadPendingPlatform] = useState<DownloadPlatform>(null);

  useEffect(() => {
    const handleOpenBill = (event: Event) => {
      const custom = event as CustomEvent<{ format?: BillFormat }>;
      setBillFormat(custom.detail?.format ?? "standard");
      setBillOpen(true);
    };

    const handleOpenCredentials = () => setCredentialsOpen(true);
    const handleOpenAuth = (event: Event) => {
      const custom = event as CustomEvent<{ mode?: AuthMode; downloadPendingPlatform?: DownloadPlatform }>;
      setAuthMode(custom.detail?.mode ?? "login");
      setDownloadPendingPlatform(custom.detail?.downloadPendingPlatform ?? null);
      setAuthOpen(true);
    };

    window.addEventListener("orderitup_open_bill_modal", handleOpenBill);
    window.addEventListener("orderitup_open_credentials_modal", handleOpenCredentials);
    window.addEventListener("orderitup_open_auth_modal", handleOpenAuth);

    return () => {
      window.removeEventListener("orderitup_open_bill_modal", handleOpenBill);
      window.removeEventListener("orderitup_open_credentials_modal", handleOpenCredentials);
      window.removeEventListener("orderitup_open_auth_modal", handleOpenAuth);
    };
  }, []);

  return (
    <>
      <BillTemplateModal
        isOpen={billOpen}
        onClose={() => setBillOpen(false)}
        initialFormat={billFormat}
      />

      <CredentialsModal
        isOpen={credentialsOpen}
        onClose={() => setCredentialsOpen(false)}
      />
      {authOpen && (
        <AuthModal
          key={authMode}
          isOpen={authOpen}
          initialMode={authMode}
          downloadPendingPlatform={downloadPendingPlatform}
          onClose={() => setAuthOpen(false)}
        />
      )}
    </>
  );
}
