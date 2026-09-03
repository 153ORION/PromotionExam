import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Search, Shield, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/management', { params: { search } });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleRoleChange = async (hrRecordId: number, role: string) => {
    try {
      const res = await api.post(`/users/role/${hrRecordId}?role=${role}`);
      setActionMessage(res.data.message);
      fetchUsers();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleToggleStatus = async (hrRecordId: number) => {
    try {
      const res = await api.post(`/users/toggle-status/${hrRecordId}`);
      setActionMessage(res.data.message);
      fetchUsers();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500">Manage employee accounts, assign Admin / SuperAdmin roles, and control access.</p>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-sm">
          {actionMessage}
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by ID, name, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Showing {users.length} registered users
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Designation & Dept</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No users found matching query.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.hrRecordId}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">ID: {u.loginId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{u.designation || 'Staff'}</div>
                      <div className="text-xs text-slate-500">{u.departmentName || 'General'}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{u.companyName || 'Orion Group'}</TableCell>
                    <TableCell>
                      {u.isSuperAdmin ? (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300">Super Admin</Badge>
                      ) : u.isAdmin ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">Admin</Badge>
                      ) : (
                        <Badge variant="secondary">Member / Examinee</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <span className="inline-flex items-center text-xs text-emerald-700 font-medium">
                          <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-red-600 font-medium">
                          <XCircle className="h-3.5 w-3.5 mr-1 text-red-500" /> Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!u.isSuperAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRoleChange(u.hrRecordId, u.isAdmin ? 'member' : 'admin')}
                          className="text-xs"
                        >
                          {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={u.isActive ? 'destructive' : 'success'}
                        onClick={() => handleToggleStatus(u.hrRecordId)}
                        className="text-xs"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
