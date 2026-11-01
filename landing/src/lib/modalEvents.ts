"use client";

export type BillFormat = "standard" | "gst" | "zreport" | "kot";

export function triggerOpenBillModal(format: BillFormat = "standard") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("orderitup_open_bill_modal", {
      detail: { format },
    })
  );
}
