import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { usePageTitle } from '@/hooks/usePageTitle';

export const Layout: React.FC = () => {
  // Automatically updates browser tab title on every route change
  usePageTitle();

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 px-4 py-6 overflow-y-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
