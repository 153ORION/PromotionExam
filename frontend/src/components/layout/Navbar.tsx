import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { LogOut, User as UserIcon, Shield, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-900 px-4 shadow-sm flex-shrink-0">
      <div className="flex items-center space-x-3">
        <CompanyLogo className="h-10 w-auto max-h-11 max-w-[140px] object-contain flex-shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Promotion Assessment Platform</h1>
          <p className="text-xs text-slate-400 font-medium">Enterprise Assessment System</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center space-x-3 border-l border-slate-700 pl-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-100">{user.name}</div>
              <div className="flex items-center justify-end space-x-1.5 text-xs text-slate-400">
                <span>{user.designation || user.loginId}</span>
                {user.isSuperAdmin && (
                  <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ml-1">
                    SUPER ADMIN
                  </span>
                )}
                {!user.isSuperAdmin && user.isAdmin && (
                  <span className="rounded bg-blue-400/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 ml-1">
                    ADMIN
                  </span>
                )}
              </div>
            </div>

            <Link to="/profile" title="View Profile">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors">
                <UserIcon className="h-5 w-5" />
              </div>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300 border-red-500/40 flex items-center space-x-1"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
