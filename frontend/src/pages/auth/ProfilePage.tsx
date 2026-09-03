import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User as UserIcon, Building, Mail, Phone, Briefcase, MapPin, Key, CheckCircle, AlertCircle } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<any>(user);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [isChangingPw, setIsChangingPw] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/users/profile');
        setProfile(res.data);
      } catch {
        // fallback to auth context user
      }
    };
    fetchProfile();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess(null);
    setPwError(null);

    if (newPassword !== confirmPassword) {
      setPwError('New Password and Confirm Password do not match.');
      return;
    }

    setIsChangingPw(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
        confirmPassword,
      });
      setPwSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setIsChangingPw(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">User Profile & Account</h2>
        <p className="text-sm text-slate-500">Manage your employee information and password settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: User Card */}
        <Card className="md:col-span-1 border-slate-200 shadow-sm text-center">
          <CardContent className="pt-6 space-y-4">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-blue-600 border-2 border-blue-200">
              <UserIcon className="h-12 w-12" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{profile?.name}</h3>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{profile?.loginId}</p>
              <p className="text-sm text-slate-500 mt-1">{profile?.designation || 'Staff Member'}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 text-left space-y-2 text-xs text-slate-600">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-slate-400" />
                <span>{profile?.companyName || 'Not Assigned'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Briefcase className="h-4 w-4 text-slate-400" />
                <span>{profile?.departmentName || 'Not Assigned'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{profile?.locationName || 'Tejgaon, Dhaka'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{profile?.email || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{profile?.mobile || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Change Password */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-blue-600" />
              <CardTitle>Security & Password</CardTitle>
            </div>
            <CardDescription>Update your login password regularly for secure access.</CardDescription>
          </CardHeader>

          <form onSubmit={handleChangePassword}>
            <CardContent className="space-y-4">
              {pwSuccess && (
                <div className="flex items-center space-x-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200">
                  <CheckCircle className="h-5 w-5" />
                  <span>{pwSuccess}</span>
                </div>
              )}
              {pwError && (
                <div className="flex items-center space-x-2 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                  <AlertCircle className="h-5 w-5" />
                  <span>{pwError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Current Password</label>
                <Input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" disabled={isChangingPw} className="bg-blue-600 hover:bg-blue-700">
                {isChangingPw ? 'Updating Password...' : 'Save New Password'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
