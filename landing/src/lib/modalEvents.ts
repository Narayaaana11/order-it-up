"use client";

export type AuthMode = "login" | "signup";
export type DownloadPlatform = "windows" | "mac" | "linux" | "any" | null;
export type BillFormat = "standard" | "gst" | "zreport" | "kot";
export type LegalTab = "terms" | "privacy" | "disclaimer" | "tax";

export function triggerOpenAuthModal(
  mode: AuthMode = "login",
  downloadPendingPlatform: DownloadPlatform = null
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("orderitup_open_auth_modal", {
      detail: { mode, downloadPendingPlatform },
    })
  );
}

export function triggerOpenBillModal(format: BillFormat = "standard") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("orderitup_open_bill_modal", {
      detail: { format },
    })
  );
}

export function triggerOpenTermsModal(tab: LegalTab = "terms") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("orderitup_open_terms_modal", {
      detail: { tab },
    })
  );
}

export function triggerOpenLicenseModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("orderitup_open_terms_modal", { detail: { tab: "terms" } }));
}

export function triggerOpenCredentialsModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("orderitup_open_credentials_modal"));
}

