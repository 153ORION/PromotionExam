import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, Search } from 'lucide-react';
import { ExamBatch, ExamRegistration, QuestionSet } from '@/types';
import { EXAM_STATUS, ExamStatus, examStatus, formatExamTime } from '@/lib/examStatus';
import { AnswerSheetDialog, ExamStatusBadge } from '@/components/exam/AnswerSheetDialog';
import { errorMessage } from '@/lib/bulkQuestionUtils';

const selectClass = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm';

type StatusFilter = '' | 'not-completed' | ExamStatus;

// Marking > Answer Sheet: every registered examinee with whether they completed the exam, and the
// answers they submitted. Answers are saved one by one while the exam runs (Exam_Answer_Sheet), so an
// exam that is still running or was never finished shows what was saved so far.
export const AnswerSheetPage: React.FC = () => {
  const [batches, setBatches] = useState<ExamBatch[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [batchId, setBatchId] = useState(0);
  const [setId, setSetId] = useState(0);
  const [status, setStatus] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [registrations, setRegistrations] = useState<ExamRegistration[]>([]);
  const [checkedAt, setCheckedAt] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ExamRegistration | null>(null);

  useEffect(() => {
    api.get<ExamBatch[]>('/batches', { params: { includeInactive: true } })
      .then((res) => setBatches(res.data))
      .catch((err) => console.error(err));
    // Active question sets only (the endpoint's default).
    api.get<QuestionSet[]>('/questions/sets')
      .then((res) => setSets([...res.data].sort((a, b) => a.setName.localeCompare(b.setName))))
      .catch((err) => console.error(err));
  }, []);

  const fetchRegistrations = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<ExamRegistration[]>('/registrations', { params: { batchId: batchId || undefined } })
      .then((res) => { setRegistrations(res.data); setCheckedAt(new Date()); })
      .catch((err) => setError(errorMessage(err, 'Failed to load the examinees')))
      .finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Statuses are worked out once per load, so "In Progress" turns into "Not Submitted" on Refresh.
  const rows = useMemo(
    () => registrations.map((r) => ({ r, status: examStatus(r, checkedAt) })),
    [registrations, checkedAt]);

  const inSet = useMemo(() => rows.filter(({ r }) => !setId || r.questionSetId === setId), [rows, setId]);
  const completedCount = inSet.filter((x) => x.status === 'completed').length;

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return inSet.filter(({ r, status: st }) =>
      (!status || (status === 'not-completed' ? st !== 'completed' : st === status)) &&
      (!s || (r.examineeName || '').toLowerCase().includes(s) || (r.loginId || '').toLowerCase().includes(s)));
  }, [inSet, status, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Answer Sheet</h2>
          <p className="text-sm text-slate-500">Registered examinees, whether they completed the exam, and the answers they submitted.</p>
        </div>
        <Button variant="outline" onClick={fetchRegistrations} disabled={loading} className="flex items-center gap-1">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card className="p-4 border-slate-200 shadow-sm bg-slate-50/50">
        <div className="flex flex-col lg:flex-row gap-3">
          <select className={selectClass} value={batchId} onChange={(e) => setBatchId(Number(e.target.value))} aria-label="Exam batch">
            <option value={0}>All batches</option>
            {batches.map((b) => (
              <option key={b.batchId} value={b.batchId}>{b.examName} ({b.examYear})</option>
            ))}
          </select>
          <select className={selectClass} value={setId} onChange={(e) => setSetId(Number(e.target.value))} aria-label="Question set">
            <option value={0}>All question sets</option>
            {sets.map((s) => <option key={s.setId} value={s.setId}>{s.setName}</option>)}
          </select>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="completed">{EXAM_STATUS['completed'].label}</option>
            <option value="not-completed">Not completed</option>
            <option value="in-progress">{EXAM_STATUS['in-progress'].label}</option>
            <option value="not-submitted">{EXAM_STATUS['not-submitted'].label}</option>
            <option value="not-started">{EXAM_STATUS['not-started'].label}</option>
          </select>
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or employee ID" className="pl-9" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          <span>Examinees: <strong className="text-slate-900">{inSet.length}</strong></span>
          <span>Completed: <strong className="text-emerald-700">{completedCount}</strong></span>
          <span>Not completed: <strong className="text-amber-700">{inSet.length - completedCount}</strong></span>
        </div>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Examinees</CardTitle>
          <CardDescription>
            Completed means the candidate finished and submitted the exam. Answer sheets of exams still running or
            never finished show the answers saved so far.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Batch / Question Set</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading examinees...</TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-rose-700">{error}</TableCell>
                </TableRow>
              ) : shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    {registrations.length === 0 ? 'No examinees registered.' : 'No examinees match these filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                shown.map(({ r, status: st }) => (
                  <TableRow key={r.examineeId}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{r.examineeName}</div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono">{r.loginId}</span>
                        {r.designation && ` · ${r.designation}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{r.departmentName || '-'}</TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-900">{r.batchName || '-'}</div>
                      <div className="text-xs text-slate-500">{r.setName || '-'}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 whitespace-nowrap">{formatExamTime(r.examStart)}</TableCell>
                    <TableCell><ExamStatusBadge status={st} /></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewing(r)}
                        disabled={st === 'not-started'}
                        title={st === 'not-started' ? 'The candidate has not started the exam yet' : undefined}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" /> Answer Sheet
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {viewing && <AnswerSheetDialog registration={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};
