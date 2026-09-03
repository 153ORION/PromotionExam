import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSystemConfig } from '@/context/SystemConfigContext';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { config } = useSystemConfig();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(loginId, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickLogin = (id: string, pass: string) => {
    setLoginId(id);
    setPassword(pass);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2.5 shadow-xl shadow-blue-500/20 border border-slate-700/50">
            <CompanyLogo className="h-full w-full object-contain" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-widest text-blue-400">
              {config?.companyName || 'ORION'}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Promotion Exam System</h1>
            <p className="text-sm text-slate-400">
              {config?.companyName ? `${config.companyName} • ` : ''}Enterprise Candidate Assessment Portal
            </p>
          </div>
        </div>

        <Card className="border-slate-800 bg-white shadow-2xl">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your Employee Login ID and Password to continue</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center space-x-2 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Login ID / Employee ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="e.g. admin or employee ID"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? 'Authenticating...' : 'Sign In to Portal'}
              </Button>

              <div className="pt-2 border-t border-slate-100 w-full text-center">
                <p className="text-xs text-slate-500 mb-2">Quick Test Accounts (Click to Fill):</p>
                <div className="flex justify-center space-x-2">
                  <button
                    type="button"
                    onClick={() => fillQuickLogin('admin', 'admin123')}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors border border-slate-200"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickLogin('examiner', 'examiner123')}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-colors border border-slate-200"
                  >
                    Examiner
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickLogin('examinee', 'examinee123')}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition-colors border border-slate-200"
                  >
                    Examinee
                  </button>
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>

        <p className="text-xs text-slate-500 text-center font-medium">
          © {new Date().getFullYear()} {config?.companyName || 'ORION'}. All rights reserved.
        </p>
      </div>
    </div>
  );
};
