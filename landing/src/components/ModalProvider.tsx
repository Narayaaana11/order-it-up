"use client";

import React, { useEffect, useState } from "react";
import BillTemplateModal from "@/components/BillTemplateModal";
import CredentialsModal from "@/components/CredentialsModal";
import type { BillFormat } from "@/lib/modalEvents";

export default function ModalProvider() {
  const [billOpen, setBillOpen] = useState(false);
  const [billFormat, setBillFormat] = useState<BillFormat>("standard");
  const [credentialsOpen, setCredentialsOpen] = useState(false);

  useEffect(() => {
    const handleOpenBill = (event: Event) => {
      const custom = event as CustomEvent<{ format?: BillFormat }>;
      setBillFormat(custom.detail?.format ?? "standard");
      setBillOpen(true);
    };

    const handleOpenCredentials = () => setCredentialsOpen(true);

    window.addEventListener("orderitup_open_bill_modal", handleOpenBill);
    window.addEventListener("orderitup_open_credentials_modal", handleOpenCredentials);

    return () => {
      window.removeEventListener("orderitup_open_bill_modal", handleOpenBill);
      window.removeEventListener("orderitup_open_credentials_modal", handleOpenCredentials);
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
    </>
  );
}
