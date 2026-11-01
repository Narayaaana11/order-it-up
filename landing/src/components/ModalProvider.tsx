"use client";

import React, { useEffect, useState } from "react";
import BillTemplateModal from "@/components/BillTemplateModal";
import type { BillFormat } from "@/lib/modalEvents";

export default function ModalProvider() {
  const [billOpen, setBillOpen] = useState(false);
  const [billFormat, setBillFormat] = useState<BillFormat>("standard");

  useEffect(() => {
    const handleOpenBill = (event: Event) => {
      const custom = event as CustomEvent<{ format?: BillFormat }>;
      setBillFormat(custom.detail?.format ?? "standard");
      setBillOpen(true);
    };

    window.addEventListener("orderitup_open_bill_modal", handleOpenBill);
    return () => window.removeEventListener("orderitup_open_bill_modal", handleOpenBill);
  }, []);

  return (
    <BillTemplateModal
      isOpen={billOpen}
      onClose={() => setBillOpen(false)}
      initialFormat={billFormat}
    />
  );
}
