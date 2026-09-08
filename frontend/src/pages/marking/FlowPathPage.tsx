import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import { Flowpath, ExamBatch, QuestionSet } from '@/types';

export const FlowPathPage: React.FC = () => {
  const [flowpaths, setFlowpaths] = useState<Flowpath[]>([]);
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedSetId, setSelectedSetId] = useState<number>(0);

  useEffect(() => {
    const initData = async () => {
      try {
        const [resBatches, resSets] = await Promise.all([
          api.get('/batches'),
          api.get('/questions/sets')
        ]);
        const activeBatches = (resBatches.data || []).filter((b: ExamBatch) => b.isActive !== false);
        setBatches(activeBatches);
        if (activeBatches.length > 0) {
          setSelectedBatchId(activeBatches[0].batchId);
        }

        const activeSets = (resSets.data || []).filter((s: QuestionSet) => s.isActive !== false);
        setSets(activeSets);
        if (activeSets.length > 0) {
          setSelectedSetId(activeSets[0].setId);
        }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <GitBranch className="h-6 w-6 text-blue-600" />
            <span>Examiner Flow Path Routing</span>
          </h2>
          <p className="text-sm text-slate-500">
            Configure evaluator assignment and multi-tier approval ranks for narrative scoring.
          </p>
        </div>
        <Link to="/marking/assign-examiner">
          <Button className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Assign Examiner</span>
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-700">Batch:</span>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-600 focus:outline-none"
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
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-600 focus:outline-none"
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
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500 space-y-2">
                    <p className="font-semibold text-slate-700">No flow path assignments found.</p>
                    <p className="text-xs text-slate-400">
                      Click &quot;Assign Examiner&quot; above to route examiners to this batch and paper set.
                    </p>
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
                    <TableCell>
                      <div className="font-semibold text-slate-900">{f.examinerName || `ID: ${f.examinerId}`}</div>
                      {f.examinerCode && (
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                            {f.examinerCode}
                          </span>
                        </div>
                      )}
                    </TableCell>
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
    </div>
  );
};
