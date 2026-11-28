"use client";

import { useEffect } from "react";
import { getCloudPortalUrl } from "@/lib/urls";

const CLOUD_PORTAL_LOGIN_URL = getCloudPortalUrl("/auth/login/");

export default function CloudPosRedirectPage() {
  useEffect(() => {
    window.location.href = CLOUD_PORTAL_LOGIN_URL;
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center font-sans">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      <h1 className="text-xl font-bold text-slate-900">Redirecting to Order It Up Cloud POS...</h1>
      <p className="mt-2 text-sm text-slate-600">Connecting you to the Order It Up Cloud POS portal.</p>
      <div className="mt-6">
        <a
          href={CLOUD_PORTAL_LOGIN_URL}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-700"
        >
          Click here if not redirected automatically &rarr;
        </a>
      </div>
    </div>
  );
}
