import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Activity, 
  Search, 
  Filter, 
  RefreshCw, 
  LogIn, 
  GraduationCap, 
  CheckSquare, 
  ShieldCheck, 
  Clock, 
  User, 
  Globe,
  FileCode
} from 'lucide-react';

interface UserActivity {
  activityId: number;
  hrRecordId?: number;
  loginId: string;
  userName: string;
  role: string;
  activityCategory: string;
  actionName: string;
  description: string;
  ipAddress?: string;
  timestamp: string;
  detailsJson?: string;
}

interface ActivityOverview {
  totalActivities: number;
  loginsCount: number;
  examsTakenCount: number;
  gradingCount: number;
  adminActionsCount: number;
}

export const UserActivityPage: React.FC = () => {
  const [logs, setLogs] = useState<UserActivity[]>([]);
  const [overview, setOverview] = useState<ActivityOverview>({
    totalActivities: 0,
    loginsCount: 0,
    examsTakenCount: 0,
    gradingCount: 0,
    adminActionsCount: 0,
  });

  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeLog, setActiveLog] = useState<UserActivity | null>(null);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const [resLogs, resOverview] = await Promise.all([
        api.get('/system/activitylogs', {
          params: {
            search: search.trim() || undefined,
            role: selectedRole !== 'ALL' ? selectedRole : undefined,
            category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
            limit: 150,
          },
        }),
        api.get('/system/activitylogs/overview'),
      ]);

      setLogs(resLogs.data);
      setOverview(resOverview.data);
    } catch (err) {
      console.error('Error loading activity logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [selectedRole, selectedCategory]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchActivities();
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'superadmin':
        return <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold">SuperAdmin</Badge>;
      case 'admin':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold">Admin</Badge>;
      case 'examinee':
      default:
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-semibold">Examinee</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'AUTH':
        return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Authentication</span>;
      case 'EXAM':
        return <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">Exam Session</span>;
      case 'GRADING':
        return <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Grading / Score</span>;
      case 'HR':
        return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">HR / Batch</span>;
      case 'ADMIN':
        return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Administration</span>;
      default:
        return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{category}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <span>User Activity Audit Trail</span>
          </h2>
          <p className="text-sm text-slate-500">
            Real-time tracking of all actions performed by SuperAdmins, Admins, Faculty Examiners, and Examinees.
          </p>
        </div>
        <Button variant="outline" onClick={fetchActivities} className="flex items-center space-x-1">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Tracked</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{overview.totalActivities}</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 flex items-center space-x-1">
            <LogIn className="h-3.5 w-3.5" />
            <span>Logins</span>
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{overview.loginsCount}</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 flex items-center space-x-1">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Exams Taken</span>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{overview.examsTakenCount}</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-600 flex items-center space-x-1">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Grading Events</span>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{overview.gradingCount}</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 flex items-center space-x-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Admin Actions</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{overview.adminActionsCount}</div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-700">Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All Roles</option>
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="Admin">Admin / Examiner</option>
              <option value="Examinee">Examinee / Member</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-700">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All Categories</option>
              <option value="AUTH">Authentication</option>
              <option value="EXAM">Examination Session</option>
              <option value="GRADING">Grading & Scores</option>
              <option value="HR">HR & Batches</option>
              <option value="ADMIN">Administration</option>
            </select>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search user name, login ID, or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 bg-white"
            />
          </div>

          <Button onClick={fetchActivities} size="sm" className="bg-blue-600 hover:bg-blue-700">
            Search
          </Button>
        </div>
      </Card>

      {/* Activity Timeline Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Activity Records</CardTitle>
          <CardDescription>Showing recent logged activities across all users ({logs.length})</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>User / Role</TableHead>
                <TableHead>Category / Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Loading activity trail...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No activity logs found for the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.activityId}>
                    <TableCell className="font-mono text-xs text-slate-400">#{log.activityId}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{log.userName}</div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs text-slate-500 font-mono">ID: {log.loginId}</span>
                        {getRoleBadge(log.role)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getCategoryBadge(log.activityCategory)}
                        <div className="text-xs font-mono font-semibold text-slate-700">
                          {log.actionName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-800 max-w-md leading-snug">
                      {log.description}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 font-mono">
                      {log.ipAddress ? (
                        <span className="flex items-center space-x-1">
                          <Globe className="h-3 w-3 text-slate-400" />
                          <span>{log.ipAddress}</span>
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {log.detailsJson ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveLog(log);
                            setDetailModalOpen(true);
                          }}
                          className="text-xs"
                        >
                          Payload
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details JSON Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogHeader>
          <DialogTitle>Activity Payload Details</DialogTitle>
          <DialogDescription>
            Metadata recorded for Activity #{activeLog?.activityId} ({activeLog?.actionName})
          </DialogDescription>
        </DialogHeader>

        {activeLog?.detailsJson && (
          <div className="rounded-lg bg-slate-900 p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-80">
            <pre>{JSON.stringify(JSON.parse(activeLog.detailsJson), null, 2)}</pre>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
