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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-[#F07928] selection:text-white">
      {children}
    </div>
  );
}
