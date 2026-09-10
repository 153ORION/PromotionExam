import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ExamBatch, LookupItem } from '@/types';

export const ExamBatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ExamBatch | null>(null);
  const [examYears, setExamYears] = useState<LookupItem[]>([]);
  const [examName, setExamName] = useState('');
  const [examYear, setExamYear] = useState<number>(new Date().getFullYear());
  const [examStart, setExamStart] = useState('');
  const [examEnd, setExamEnd] = useState('');
  const [mcqQuestion, setMcqQuestion] = useState<number>(20);
  const [mcqMark, setMcqMark] = useState<number>(20);
  const [academicQuestion, setAcademicQuestion] = useState<number>(0);
  const [maxAcademic, setMaxAcademic] = useState<number>(0);
  const [generalQuestion, setGeneralQuestion] = useState<number>(0);
  const [maxGeneral, setMaxGeneral] = useState<number>(0);
  const [jobRelatedQuestion, setJobRelatedQuestion] = useState<number>(0);
  const [maxJobRelated, setMaxJobRelated] = useState<number>(0);
  const [examDuration, setExamDuration] = useState<number>(60);
  const [isMultipleExaminer, setIsMultipleExaminer] = useState<boolean>(true);
  const [allowPreviewMarking, setAllowPreviewMarking] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/batches', { params: { includeInactive: true } });
      setBatches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    // Exam Year options come from lookup table (typeid = 1)
    api.get('/lookups/items', { params: { typeId: 1 } })
      .then((res) => {
        const items: LookupItem[] = res.data;
        setExamYears(items);
        if (items.length > 0 && !items.some((y) => Number(y.lookupText) === new Date().getFullYear())) {
          setExamYear(Number(items[0].lookupText) || items[0].lookupId);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Computed written distribution:
  // Total Written Questions = MaxAcademic + MaxGeneral + MaxJobRelated
  // Total Written Marks = Total Written Questions * 10
  const computedTotalWrittenQuestion =
    (Number(maxAcademic) || 0) + (Number(maxGeneral) || 0) + (Number(maxJobRelated) || 0);
  const computedWrittenMark = computedTotalWrittenQuestion * 10;
  const computedTotalMark = (Number(mcqMark) || 0) + computedWrittenMark;

  const examYearOptions = examYears.map((y) => ({
    id: Number(y.lookupText) || y.lookupId,
    title: y.lookupText,
  }));

  // Auto-calculated: End Date & Time = (Start Date & Time) + Duration (Minutes)
  const toLocalDateTimeInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const recalcExamEnd = (start: string, duration: number) => {
    if (!start) return '';
    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) return '';
    return toLocalDateTimeInput(new Date(startDate.getTime() + (Number(duration) || 0) * 60000));
  };

  const handleExamStartChange = (value: string) => {
    setExamStart(value);
    setExamEnd(recalcExamEnd(value, examDuration));
  };

  const handleExamDurationChange = (value: number) => {
    setExamDuration(value);
    setExamEnd(recalcExamEnd(examStart, value));
  };

  const handleOpenAdd = () => {
    setEditingBatch(null);
    setExamName('');
    const currentYear = new Date().getFullYear();
    const yearExists = examYears.some((y) => Number(y.lookupText) === currentYear);
    setExamYear(
      yearExists
        ? currentYear
        : examYears.length > 0
        ? Number(examYears[0].lookupText) || examYears[0].lookupId
        : currentYear
    );
    const startValue = toLocalDateTimeInput(new Date());
    setExamStart(startValue);
    setExamEnd(recalcExamEnd(startValue, 60));
    setMcqQuestion(20);
    setMcqMark(20);
    setAcademicQuestion(0);
    setMaxAcademic(0);
    setGeneralQuestion(0);
    setMaxGeneral(0);
    setJobRelatedQuestion(0);
    setMaxJobRelated(0);
    setExamDuration(60);
    setIsMultipleExaminer(true);
    setAllowPreviewMarking(true);
    setDialogOpen(true);
  };

  const handleOpenEdit = (b: ExamBatch) => {
    setEditingBatch(b);
    setExamName(b.examName);
    setExamYear(b.examYear);
    const startValue = b.examStart ? b.examStart.slice(0, 16) : '';
    const durationValue = b.examDuration || 60;
    setExamStart(startValue);
    setExamEnd(recalcExamEnd(startValue, durationValue));
    setMcqQuestion(b.mcqQuestion || 20);
    setMcqMark(b.mcqMark || 20);
    setAcademicQuestion(b.academicQuestion ?? 0);
    setMaxAcademic(b.maxAcademic ?? 0);
    setGeneralQuestion(b.generalQuestion ?? 0);
    setMaxGeneral(b.maxGeneral ?? 0);
    setJobRelatedQuestion(b.jobRelatedQuestion ?? 0);
    setMaxJobRelated(b.maxJobRelated ?? 0);
    setExamDuration(durationValue);
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
        academicQuestion: Number(academicQuestion),
        maxAcademic: Number(maxAcademic),
        generalQuestion: Number(generalQuestion),
        maxGeneral: Number(maxGeneral),
        jobRelatedQuestion: Number(jobRelatedQuestion),
        maxJobRelated: Number(maxJobRelated),
        totalWrittenQuestion: computedTotalWrittenQuestion,
        writtenMark: computedWrittenMark,
        totalMark: computedTotalMark,
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
                <TableHead>Batch Name</TableHead>
                <TableHead className="text-center">Year</TableHead>
                <TableHead>Start / End Window</TableHead>
                <TableHead className="text-center">Duration</TableHead>
                <TableHead className="text-center" title="Max / Available">Academic</TableHead>
                <TableHead className="text-center" title="Max / Available">General</TableHead>
                <TableHead className="text-center" title="Max / Available">Job Related</TableHead>
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
                  <TableCell colSpan={13} className="text-center py-8 text-slate-500">
                    Loading batches...
                  </TableCell>
                </TableRow>
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-slate-500">
                    No exam batches configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => (
                  <TableRow key={b.batchId}>
                    <TableCell className="font-mono text-xs text-slate-500">#{b.batchId}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{b.examName}</div>
                      {b.isMultipleExaminer && (
                        <div className="mt-1">
                          <span className="text-[10px] bg-purple-100 text-purple-700 font-medium px-1.5 py-0.5 rounded border border-purple-200">
                            Multi-Examiner
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {b.examYear}
                      </span>
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
                    <TableCell className="text-center font-mono text-xs font-bold">
                      <span className="text-[15px] text-emerald-600">{b.maxAcademic ?? 0}</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-blue-600">{b.academicQuestion ?? 0}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold">
                      <span className="text-[15px] text-emerald-600">{b.maxGeneral ?? 0}</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-blue-600">{b.generalQuestion ?? 0}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold">
                      <span className="text-[15px] text-emerald-600">{b.maxJobRelated ?? 0}</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-blue-600">{b.jobRelatedQuestion ?? 0}</span>
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} className="max-w-3xl">
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
              <SearchableSelect
                options={examYearOptions}
                selectedId={examYear}
                onSelect={(opt) => setExamYear(opt ? Number(opt.id) : new Date().getFullYear())}
                placeholder="Select exam year..."
                searchPlaceholder="Search year..."
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Duration (Minutes)</label>
              <Input
                type="number"
                value={examDuration}
                onChange={(e) => handleExamDurationChange(Number(e.target.value))}
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
                onChange={(e) => handleExamStartChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                End Date & Time{' '}
                <span className="text-xs font-normal text-slate-400">(auto: Start + Duration)</span>
              </label>
              <Input
                type="datetime-local"
                value={examEnd}
                readOnly
                className="bg-slate-100 text-slate-600"
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

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Written Questions Distribution
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Academic Questions</label>
                  <Input
                    type="number"
                    min={0}
                    value={academicQuestion}
                    onChange={(e) => setAcademicQuestion(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Max Academic</label>
                  <Input
                    type="number"
                    min={0}
                    value={maxAcademic}
                    onChange={(e) => setMaxAcademic(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">General Questions</label>
                  <Input
                    type="number"
                    min={0}
                    value={generalQuestion}
                    onChange={(e) => setGeneralQuestion(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Max General</label>
                  <Input
                    type="number"
                    min={0}
                    value={maxGeneral}
                    onChange={(e) => setMaxGeneral(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Job Related Questions</label>
                  <Input
                    type="number"
                    min={0}
                    value={jobRelatedQuestion}
                    onChange={(e) => setJobRelatedQuestion(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Max Job Related</label>
                  <Input
                    type="number"
                    min={0}
                    value={maxJobRelated}
                    onChange={(e) => setMaxJobRelated(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
              <div className="p-2 bg-white border border-blue-200 rounded-md text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Total Written Questions
                </span>
                <span className="text-base font-bold text-blue-700">{computedTotalWrittenQuestion}</span>
              </div>
              <div className="p-2 bg-white border border-blue-200 rounded-md text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Total Written Marks (10 per question)
                </span>
                <span className="text-base font-bold text-blue-700">{computedWrittenMark}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900 font-semibold text-center">
            Total Combined Exam Marks: {computedTotalMark}
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
