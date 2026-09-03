import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, GitBranch, ShieldCheck } from 'lucide-react';
import { Flowpath, ExamBatch, QuestionSet } from '@/types';

export const FlowPathPage: React.FC = () => {
  const [flowpaths, setFlowpaths] = useState<Flowpath[]>([]);
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [examiners, setExaminers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formBatchId, setFormBatchId] = useState<number>(0);
  const [formSetId, setFormSetId] = useState<number>(0);
  const [formExaminerId, setFormExaminerId] = useState<number>(0);
  const [formRank, setFormRank] = useState<number>(1);
  const [formApprover, setFormApprover] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resSets, resUsers] = await Promise.all([
          api.get('/batches'),
          api.get('/questions/sets'),
          api.get('/users/management')
        ]);
        setBatches(resBatches.data);
        if (resBatches.data.length > 0) {
          setSelectedBatchId(resBatches.data[0].batchId);
          setFormBatchId(resBatches.data[0].batchId);
        }

        setSets(resSets.data);
        if (resSets.data.length > 0) {
          setSelectedSetId(resSets.data[0].setId);
          setFormSetId(resSets.data[0].setId);
        }

        // Filter only Admins / Examiners
        const examUsers = resUsers.data.filter((u: any) => u.isAdmin || u.isSuperAdmin);
        setExaminers(examUsers);
        if (examUsers.length > 0) setFormExaminerId(examUsers[0].hrRecordId);
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, []);

  const fetchFlowpaths = async () => {
    setLoading(true);
    try {
      const res = await api.get('/flowpaths', {
        params: {
          batchId: selectedBatchId > 0 ? selectedBatchId : undefined,
          setId: selectedSetId > 0 ? selectedSetId : undefined,
        }
      });
      setFlowpaths(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowpaths();
  }, [selectedBatchId, selectedSetId]);

  const handleOpenAdd = () => {
    setFormBatchId(selectedBatchId > 0 ? selectedBatchId : (batches[0]?.batchId || 0));
    setFormSetId(selectedSetId > 0 ? selectedSetId : (sets[0]?.setId || 0));
    setFormExaminerId(examiners[0]?.hrRecordId || 0);
    setFormRank(flowpaths.length + 1);
    setFormApprover(true);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formBatchId <= 0 || formSetId <= 0 || formExaminerId <= 0) return;

    setSubmitting(true);
    try {
      await api.post('/flowpaths', {
        batchId: formBatchId,
        examSetId: formSetId,
        examinerId: formExaminerId,
        rank: Number(formRank),
        approver: formApprover
      });
      setDialogOpen(false);
      fetchFlowpaths();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign flow path');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this examiner flow path?')) return;
    try {
      await api.delete(`/flowpaths/${id}`);
      fetchFlowpaths();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove flow path');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Examiner Flow Path Routing</h2>
          <p className="text-sm text-slate-500">Configure evaluator assignment and multi-tier approval ranks for narrative scoring.</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>Assign Examiner</span>
        </Button>
      </div>

      {/* Filter */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Batch:</span>
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
            <span className="text-sm font-semibold text-slate-700">Set:</span>
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
        </div>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Assigned Evaluation Paths</CardTitle>
          <CardDescription>Order of evaluation rankings and approver designations.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Examiner / Faculty</TableHead>
                <TableHead>Designation & Dept</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Paper Set</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Loading flow paths...
                  </TableCell>
                </TableRow>
              ) : flowpaths.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No flow path assignments found.
                  </TableCell>
                </TableRow>
              ) : (
                flowpaths.map((f) => (
                  <TableRow key={f.path_Id}>
                    <TableCell className="font-bold text-center text-blue-700">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs">
                        {f.rank}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">{f.examinerName || `ID: ${f.examinerId}`}</TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{f.examinerDesignation || 'Staff'}</div>
                      <div className="text-xs text-slate-500">{f.examinerDepartment || 'General'}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{f.batchName}</TableCell>
                    <TableCell className="text-sm text-slate-700">{f.setName}</TableCell>
                    <TableCell>
                      {f.approver ? (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300">Final Approver</Badge>
                      ) : (
                        <Badge variant="secondary">Evaluator</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(f.path_Id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>Assign Examiner to Flow Path</DialogTitle>
          <DialogDescription>
            Select the Batch, Question Set, and qualified Examiner for grading.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Exam Batch</label>
            <select
              value={formBatchId}
              onChange={(e) => setFormBatchId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              required
            >
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.examName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Question Set</label>
            <select
              value={formSetId}
              onChange={(e) => setFormSetId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              required
            >
              {sets.map((s) => (
                <option key={s.setId} value={s.setId}>
                  {s.setName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Examiner</label>
            <select
              value={formExaminerId}
              onChange={(e) => setFormExaminerId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              required
            >
              {examiners.map((u) => (
                <option key={u.hrRecordId} value={u.hrRecordId}>
                  {u.name} ({u.loginId}) - {u.designation || 'Faculty'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Evaluation Rank</label>
              <Input
                type="number"
                min="1"
                value={formRank}
                onChange={(e) => setFormRank(Number(e.target.value))}
                required
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="approverCheck"
                checked={formApprover}
                onChange={(e) => setFormApprover(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="approverCheck" className="text-sm font-medium text-slate-700 cursor-pointer">
                Authorized Final Approver
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
