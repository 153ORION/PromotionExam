import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter, UserX, Trash2, CheckCircle2 } from 'lucide-react';
import { ExamRegistration, ExamBatch, QuestionSet } from '@/types';

export const UnregistrationPage: React.FC = () => {
  const [registrations, setRegistrations] = useState<ExamRegistration[]>([]);
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resSets] = await Promise.all([
          api.get('/batches'),
          api.get('/questions/sets'),
        ]);
        const activeBatches = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        if (activeBatches.length > 0) setSelectedBatchId(activeBatches[0].batchId);

        const activeSets = (resSets.data || []).filter((s: QuestionSet) => s.isActive !== false);
        setSets(activeSets);
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, []);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/registrations', {
        params: {
          batchId: selectedBatchId > 0 ? selectedBatchId : undefined,
          questionSetId: selectedSetId > 0 ? selectedSetId : undefined,
        },
      });
      setRegistrations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [selectedBatchId, selectedSetId]);

  const handleUnregister = async (examineeId: number, name: string) => {
    if (!confirm(`Are you sure you want to unregister ${name} from this exam batch?`)) return;

    try {
      await api.delete(`/registrations/${examineeId}`);
      fetchRegistrations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unregister examinee.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Examinee Unregistration & Roster</h2>
          <p className="text-sm text-slate-500">View candidates registered for exams and remove eligible candidates if needed.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Exam Batch:</span>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            >
              <option value="0">-- All Batches --</option>
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.examName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Question Set:</span>
            <select
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            >
              <option value="0">-- All Sets --</option>
              {sets.map((s) => (
                <option key={s.setId} value={s.setId}>
                  {s.setName}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-xs font-semibold text-slate-500">
            Total Registered: {registrations.length}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Registered Examinees</CardTitle>
          <CardDescription>Candidates assigned to take the selected exam batch.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Designation & Dept</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Set Name</TableHead>
                <TableHead>Exam Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Loading registrations...
                  </TableCell>
                </TableRow>
              ) : registrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No examinees found for the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                registrations.map((r) => (
                  <TableRow key={r.examineeId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{r.examineeId}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{r.examineeName}</div>
                      <div className="text-xs text-slate-500">ID: {r.loginId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{r.designation || 'Staff'}</div>
                      <div className="text-xs text-slate-500">{r.departmentName || 'General'}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{r.batchName || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-700">{r.setName || '-'}</TableCell>
                    <TableCell>
                      {r.isExamEnd ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Submitted</Badge>
                      ) : r.isAttand ? (
                        <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
                      ) : (
                        <Badge variant="secondary">Registered</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleUnregister(r.examineeId, r.examineeName)}
                        className="text-xs"
                      >
                        <UserX className="h-3.5 w-3.5 mr-1" /> Unregister
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
