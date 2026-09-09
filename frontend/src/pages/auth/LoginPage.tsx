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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        
        <Card className="border-slate-800 bg-white shadow-2xl">
        <div className="text-center space-y-3">
          <div className="inline-flex h-30 w-30 items-center justify-center p-2.5">
            <CompanyLogo className="h-full w-full object-contain" />
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black font-bold uppercase tracking-widest text-blue-400">
              {config?.companyName || 'ORION'}
            </div>
            <h1 className="text-lg font-bold tracking-tight">Promotion Assessment Platform (PAP)</h1>
            <p className="text-sm text-slate-400">
                A modern enterprise platform designed to streamline promotion examinations, candidate assessment, examiner evaluation, marking, and feedback.
            </p>
          </div>
        </div>

        
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
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
                <label className="text-sm font-medium text-slate-700">Employee ID</label>
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
