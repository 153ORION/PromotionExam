import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, CheckCircle, XCircle, Clock, Calendar, FileText } from 'lucide-react';
import { ExamBatch } from '@/types';

export const ExamBatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ExamBatch | null>(null);
  const [examName, setExamName] = useState('');
  const [examYear, setExamYear] = useState<number>(new Date().getFullYear());
  const [examStart, setExamStart] = useState('');
  const [examEnd, setExamEnd] = useState('');
  const [mcqQuestion, setMcqQuestion] = useState<number>(20);
  const [mcqMark, setMcqMark] = useState<number>(20);
  const [totalWrittenQuestion, setTotalWrittenQuestion] = useState<number>(2);
  const [writtenMark, setWrittenMark] = useState<number>(20);
  const [examDuration, setExamDuration] = useState<number>(60);
  const [isMultipleExaminer, setIsMultipleExaminer] = useState<boolean>(true);
  const [allowPreviewMarking, setAllowPreviewMarking] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/batches');
      setBatches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleOpenAdd = () => {
    setEditingBatch(null);
    setExamName('');
    setExamYear(new Date().getFullYear());
    setExamStart(new Date().toISOString().slice(0, 16));
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setExamEnd(nextWeek.toISOString().slice(0, 16));
    setMcqQuestion(20);
    setMcqMark(20);
    setTotalWrittenQuestion(2);
    setWrittenMark(20);
    setExamDuration(60);
    setIsMultipleExaminer(true);
    setAllowPreviewMarking(true);
    setDialogOpen(true);
  };

  const handleOpenEdit = (b: ExamBatch) => {
    setEditingBatch(b);
    setExamName(b.examName);
    setExamYear(b.examYear);
    setExamStart(b.examStart ? b.examStart.slice(0, 16) : '');
    setExamEnd(b.examEnd ? b.examEnd.slice(0, 16) : '');
    setMcqQuestion(b.mcqQuestion || 20);
    setMcqMark(b.mcqMark || 20);
    setTotalWrittenQuestion(b.totalWrittenQuestion || 2);
    setWrittenMark(b.writtenMark || 20);
    setExamDuration(b.examDuration || 60);
    setIsMultipleExaminer(b.isMultipleExaminer ?? true);
    setAllowPreviewMarking(b.allowPreviewMarking ?? true);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/batches', {
        batchId: editingBatch?.batchId,
        examName: examName.trim(),
        examYear: Number(examYear),
        examStart: examStart ? new Date(examStart).toISOString() : null,
        examEnd: examEnd ? new Date(examEnd).toISOString() : null,
        mcqQuestion: Number(mcqQuestion),
        maxMCQ: Number(mcqQuestion),
        mcqMark: Number(mcqMark),
        totalWrittenQuestion: Number(totalWrittenQuestion),
        writtenMark: Number(writtenMark),
        totalMark: Number(mcqMark) + Number(writtenMark),
        examDuration: Number(examDuration),
        isMultipleExaminer,
        allowPreviewMarking
      });
      setDialogOpen(false);
      fetchBatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.post(`/batches/toggle/${id}`);
      fetchBatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Exam Batches & Question Pattern</h2>
          <p className="text-sm text-slate-500">Configure exam campaigns, marks distribution, and time windows.</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>Create Exam Batch</span>
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Active & Scheduled Batches</CardTitle>
          <CardDescription>Each batch defines duration, marks breakdown, and registration eligibility.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Batch Name & Year</TableHead>
                <TableHead>Start / End Window</TableHead>
                <TableHead className="text-center">Duration</TableHead>
                <TableHead className="text-center">MCQ Marks</TableHead>
                <TableHead className="text-center">Written Marks</TableHead>
                <TableHead className="text-center">Total Marks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    Loading batches...
                  </TableCell>
                </TableRow>
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    No exam batches configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => (
                  <TableRow key={b.batchId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{b.batchId}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{b.examName}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-blue-600 font-bold">Year: {b.examYear}</span>
                        {b.isMultipleExaminer && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 font-medium px-1.5 py-0.5 rounded border border-purple-200">
                            Multi-Examiner
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 space-y-0.5">
                      <div>Start: {b.examStart ? new Date(b.examStart).toLocaleDateString() : '-'}</div>
                      <div>End: {b.examEnd ? new Date(b.examEnd).toLocaleDateString() : '-'}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        <Clock className="h-3 w-3 mr-1 text-slate-500" />
                        {b.examDuration} mins
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-slate-800">
                      {b.mcqMark || 0}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-slate-800">
                      {b.writtenMark || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="rounded bg-blue-100 text-blue-800 px-2 py-0.5 font-bold text-xs">
                        {b.totalMark || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {b.isActive ? (
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
                      <Button size="sm" variant="outline" onClick={() => handleOpenEdit(b)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={b.isActive ? 'destructive' : 'success'}
                        onClick={() => handleToggle(b.batchId)}
                      >
                        {b.isActive ? 'Deactivate' : 'Activate'}
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
          <DialogTitle>{editingBatch ? 'Edit Exam Batch' : 'Create New Exam Batch'}</DialogTitle>
          <DialogDescription>
            Configure exam timing, question distribution, and total marks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Exam Batch Name</label>
            <Input
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="e.g. Promotion Examination 2026 - Batch 1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Exam Year</label>
              <Input
                type="number"
                value={examYear}
                onChange={(e) => setExamYear(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Duration (Minutes)</label>
              <Input
                type="number"
                value={examDuration}
                onChange={(e) => setExamDuration(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Start Date & Time</label>
              <Input
                type="datetime-local"
                value={examStart}
                onChange={(e) => setExamStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">End Date & Time</label>
              <Input
                type="datetime-local"
                value={examEnd}
                onChange={(e) => setExamEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Total MCQ Questions</label>
              <Input
                type="number"
                value={mcqQuestion}
                onChange={(e) => setMcqQuestion(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Total MCQ Marks</label>
              <Input
                type="number"
                value={mcqMark}
                onChange={(e) => setMcqMark(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Total Written Questions</label>
              <Input
                type="number"
                value={totalWrittenQuestion}
                onChange={(e) => setTotalWrittenQuestion(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Total Written Marks</label>
              <Input
                type="number"
                value={writtenMark}
                onChange={(e) => setWrittenMark(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900 font-semibold text-center">
            Total Combined Exam Marks: {Number(mcqMark) + Number(writtenMark)}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Examiner Marking & Preview Options
            </span>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isMultipleExaminerCheck"
                checked={isMultipleExaminer}
                onChange={(e) => setIsMultipleExaminer(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="isMultipleExaminerCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                Enable Multiple Examiner Marking (Allow multiple evaluators to grade narrative answers)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="allowPreviewMarkingCheck"
                checked={allowPreviewMarking}
                onChange={(e) => setAllowPreviewMarking(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="allowPreviewMarkingCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                Allow Examiners to Preview Previous Markings during evaluation
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Saving...' : 'Save Exam Batch'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
