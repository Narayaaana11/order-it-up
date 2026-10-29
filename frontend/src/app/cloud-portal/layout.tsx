import React from 'react';

export const metadata = {
  title: 'Order It Up Cloud HQ | Multi-Branch Franchise Portal',
  description: 'Enterprise multi-branch restaurant management, cross-store analytics, accountant reconciliation, and master catalog overrides.',
};

export default function CloudPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {children}
    </div>
  );
}
