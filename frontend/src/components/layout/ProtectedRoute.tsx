import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  requireAdmin = false, 
  requireSuperAdmin = false 
}) => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-sm font-medium text-slate-600">Loading Promotion Exam System...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !user.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && !user.isAdmin && !user.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
