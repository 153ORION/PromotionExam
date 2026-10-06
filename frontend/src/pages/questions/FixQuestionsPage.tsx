import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, Loader2, Pencil, RefreshCw, Search, Trash2, Wand2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BULK_QUESTION_PARTS, BULK_QUESTION_TYPES, BulkQuestionBatch, BulkQuestionIssue, BulkQuestionRow, BulkQuestionRowPage,
  DisputedSummary, ResolveDisputesResult, UpdateBulkQuestionResult,
} from '@/types';
import { CriteriaCell, Pager, QuestionCell } from '@/components/questions/BulkQuestionParts';
import { errorMessage, formatDateTime } from '@/lib/bulkQuestionUtils';

const PAGE_SIZE = 25;
type ProblemFilter = '' | 'Error' | 'Disputed' | 'Type' | 'Part';
const PROBLEM_FILTERS: ProblemFilter[] = ['', 'Error', 'Disputed', 'Type', 'Part'];

const selectClass = 'h-8 rounded-md border border-slate-300 bg-white px-2 text-sm disabled:opacity-50';
const textareaClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600';
const showValue = (v: string) => (v === '' ? '(empty)' : v);
const parseProblem = (v: string | null): ProblemFilter => (PROBLEM_FILTERS.includes(v as ProblemFilter) ? (v as ProblemFilter) : '');

type Banner = { type: 'success' | 'error'; text: string; failures?: ResolveDisputesResult['failed']; duplicates?: ResolveDisputesResult['duplicates'] };

// Question Bank > Fix Questions: questions saved from an Excel upload that need correcting —
// rows with validation errors, and disputed rows whose Type is not MCQ/Descriptive or whose Part
// is not 1/2/3. Disputed values can be fixed per value ("every Academic becomes Descriptive"),
// for selected questions, or inline; any row can be edited in full and is re-checked on save.
export const FixQuestionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const batchId = searchParams.get('batch') ?? '';

  const [batches, setBatches] = useState<BulkQuestionBatch[]>([]);
  const [summary, setSummary] = useState<DisputedSummary | null>(null);
  const [rows, setRows] = useState<BulkQuestionRowPage | null>(null);
  const [loading, setLoading] = useState(true);

  const [problem, setProblem] = useState<ProblemFilter>(() => parseProblem(searchParams.get('problem')));
  const [valueFilter, setValueFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [page, setPage] = useState(1);

  // Per-value fixes ("Type:Academic" -> "Descriptive") and inline per-row edits (id -> new values).
  const [valueFixes, setValueFixes] = useState<Record<string, string>>({});
  const [rowEdits, setRowEdits] = useState<Record<number, { type?: string; part?: string }>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkType, setBulkType] = useState('');
  const [bulkPart, setBulkPart] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [result, setResult] = useState<Banner | null>(null);
  const [editRow, setEditRow] = useState<BulkQuestionRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { batchId: batchId || undefined };
      const [resSummary, resRows] = await Promise.all([
        api.get<DisputedSummary>('/question-bank-upload/fix/summary', { params }),
        api.get<BulkQuestionRowPage>('/question-bank-upload/fix', {
          params: {
            ...params,
            problem: problem || undefined,
            value: valueFilter ?? undefined,
            search: searchApplied || undefined,
            page,
            pageSize: PAGE_SIZE,
          },
        }),
      ]);
      setSummary(resSummary.data);
      setRows(resRows.data);
    } catch (err) {
      setResult({ type: 'error', text: errorMessage(err, 'Failed to load the questions to fix') });
    } finally {
      setLoading(false);
    }
  }, [batchId, problem, valueFilter, searchApplied, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    api.get<BulkQuestionBatch[]>('/question-bank-upload/batches')
      .then((res) => setBatches(res.data))
      .catch((err) => console.error(err));
  }, []);

  // A page emptied by fixes or deletes falls back to the previous page.
  useEffect(() => {
    if (rows && rows.items.length === 0 && rows.total > 0 && page > 1) setPage(Math.max(1, Math.ceil(rows.total / rows.pageSize)));
  }, [rows, page]);

  const afterResolve = async (res: ResolveDisputesResult) => {
    setResult({
      type: res.failed.length || res.duplicates.length ? 'error' : 'success',
      text: res.message,
      failures: res.failed,
      duplicates: res.duplicates,
    });
    setSelected(new Set());
    setRowEdits({});
    await loadData();
  };

  const changeFilter = (next: { problem?: ProblemFilter; value?: string | null; batch?: string }) => {
    if (next.problem !== undefined) setProblem(next.problem);
    if (next.value !== undefined) setValueFilter(next.value);
    const params = new URLSearchParams(searchParams);
    if (next.batch !== undefined) {
      if (next.batch) params.set('batch', next.batch); else params.delete('batch');
    }
    if (next.problem !== undefined) {
      if (next.problem) params.set('problem', next.problem); else params.delete('problem');
    }
    setSearchParams(params, { replace: true });
    setPage(1);
    setSelected(new Set());
  };

  const fixByValue = async (col: 'Type' | 'Part', value: string) => {
    const newValue = valueFixes[`${col}:${value}`];
    if (!newValue) return;
    const count = (col === 'Type' ? summary?.typeValues : summary?.partValues)?.find((v) => v.value === value)?.count ?? 0;
    if (!confirm(`Set ${col} of ${count} question(s) from "${showValue(value)}" to "${newValue}"${batchId ? ' in this upload' : ''}?`)) return;

    setWorking(`value:${col}:${value}`);
    setResult(null);
    try {
      const res = await api.post<ResolveDisputesResult>('/question-bank-upload/fix/resolve-by-value', {
        column: col, value, newValue, uploadBatchId: batchId || null,
      });
      setValueFixes((prev) => { const next = { ...prev }; delete next[`${col}:${value}`]; return next; });
      if (valueFilter === value && problem === col) setValueFilter(null);
      await afterResolve(res.data);
    } catch (err) {
      setResult({ type: 'error', text: errorMessage(err, 'Failed to fix the questions') });
    } finally {
      setWorking(null);
    }
  };

  const resolve = async (ids: number[], questionType?: string, questionPart?: string, key = 'bulk') => {
    if (ids.length === 0 || (!questionType && !questionPart)) return;
    setWorking(key);
    setResult(null);
    try {
      const res = await api.post<ResolveDisputesResult>('/question-bank-upload/fix/resolve', {
        ids, questionType: questionType || null, questionPart: questionPart || null,
      });
      await afterResolve(res.data);
      if (key === 'bulk') { setBulkType(''); setBulkPart(''); }
    } catch (err) {
      setResult({ type: 'error', text: errorMessage(err, 'Failed to fix the questions') });
    } finally {
      setWorking(null);
    }
  };

  const deleteRow = async (row: BulkQuestionRow) => {
    if (!row.bulkQuestionId) return;
    if (!confirm(`Delete row ${row.excelRowNo} of "${row.fileName}"? The question is removed from the bulk question table. This cannot be undone.`)) return;
    setWorking(`delete:${row.bulkQuestionId}`);
    setResult(null);
    try {
      const res = await api.delete(`/question-bank-upload/questions/${row.bulkQuestionId}`);
      setResult({ type: 'success', text: res.data?.message || 'Question deleted.' });
      setSelected((prev) => { const next = new Set(prev); next.delete(row.bulkQuestionId!); return next; });
      await loadData();
    } catch (err) {
      setResult({ type: 'error', text: errorMessage(err, 'Failed to delete the question') });
    } finally {
      setWorking(null);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected question(s)? They are removed from the bulk question table. This cannot be undone.`)) return;
    setWorking('bulk-delete');
    setResult(null);
    try {
      const res = await api.post('/question-bank-upload/questions/delete', { ids: [...selected] });
      setResult({ type: 'success', text: res.data?.message || 'Questions deleted.' });
      setSelected(new Set());
      await loadData();
    } catch (err) {
      setResult({ type: 'error', text: errorMessage(err, 'Failed to delete the questions') });
    } finally {
      setWorking(null);
    }
  };

  const onEdited = async (res: UpdateBulkQuestionResult) => {
    if (res.isFixed) {
      setEditRow(null);
      setResult({ type: 'success', text: res.message });
    }
    await loadData();
  };

  const items = rows?.items ?? [];
  const allOnPageSelected = items.length > 0 && items.every((r) => selected.has(r.bulkQuestionId!));
  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((r) => (allOnPageSelected ? next.delete(r.bulkQuestionId!) : next.add(r.bulkQuestionId!)));
      return next;
    });
  };
  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const setRowEdit = (id: number, patch: { type?: string; part?: string }) =>
    setRowEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const batchesToFix = batches.filter((b) => b.disputedCount > 0 || b.errorCount > 0 || b.uploadBatchId === batchId);

  const problemCounts: Record<ProblemFilter, number | undefined> = {
    '': summary?.totalToFix,
    Error: summary?.errorRows,
    Disputed: summary?.totalDisputed,
    Type: summary?.typeDisputed,
    Part: summary?.partDisputed,
  };
  const problemLabels: Record<ProblemFilter, string> = {
    '': 'All', Error: 'Errors', Disputed: 'Disputed', Type: 'Invalid Type', Part: 'Invalid Part',
  };

  const renderValueList = (col: 'Type' | 'Part', values: { value: string; count: number }[], options: string[]) => (
    <div>
      <h3 className="text-sm font-semibold text-slate-800 mb-2">
        {col === 'Type' ? 'Type (must be MCQ or Descriptive)' : 'Part (must be 1, 2 or 3)'}
      </h3>
      {values.length === 0 ? (
        <p className="text-sm text-slate-500">No disputed {col === 'Type' ? 'types' : 'parts'}.</p>
      ) : (
        <div className="space-y-2">
          {values.map((v) => {
            const key = `${col}:${v.value}`;
            const active = problem === col && valueFilter === v.value;
            return (
              <div key={key} className={cn('flex flex-wrap items-center gap-2 rounded-md border p-2', active ? 'border-blue-300 bg-blue-50' : 'border-slate-200')}>
                <button
                  className="flex-1 min-w-[140px] text-left text-sm"
                  onClick={() => changeFilter(active ? { problem: '', value: null } : { problem: col, value: v.value })}
                  title="Show these questions"
                >
                  <span className="font-medium text-amber-800">{showValue(v.value)}</span>
                  <span className="text-slate-500"> · {v.count} question(s)</span>
                </button>
                <span className="text-xs text-slate-500">change to</span>
                <select
                  className={selectClass}
                  value={valueFixes[key] ?? ''}
                  onChange={(e) => setValueFixes((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={!!working}
                >
                  <option value="">Choose…</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <Button size="sm" onClick={() => fixByValue(col, v.value)} disabled={!valueFixes[key] || !!working}>
                  {working === `value:${key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply to all'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fix Questions</h1>
          {/* <p className="text-sm text-slate-500 mt-1">
            Uploaded questions that need correcting: rows with errors, and disputed rows whose Type is not MCQ or
            Descriptive or whose Part is not 1, 2 or 3.
          </p> */}
        </div>
        <div className="flex items-center gap-2">
          <select
            className={cn(selectClass, 'h-9 max-w-xs')}
            value={batchId}
            onChange={(e) => changeFilter({ batch: e.target.value })}
            aria-label="Upload"
          >
            <option value="">All uploads</option>
            {batchesToFix.map((b) => (
              <option key={b.uploadBatchId} value={b.uploadBatchId}>
                {b.fileName} ({formatDateTime(b.uploadedAt)}) · {b.errorCount} error(s), {b.disputedCount} disputed
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {result && (
        <div className={cn(
          'p-4 rounded-lg flex items-start gap-3 border',
          result.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200',
        )}>
          {result.type === 'success'
            ? <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            : <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />}
          <div className="text-sm flex-1">
            <p>{result.text}</p>
            {result.failures && result.failures.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs max-h-40 overflow-y-auto">
                {result.failures.map((f) => (
                  <li key={f.bulkQuestionId}>Row {f.excelRowNo} of {f.fileName}: {f.reason}</li>
                ))}
              </ul>
            )}
            {result.duplicates && result.duplicates.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs max-h-40 overflow-y-auto text-violet-900">
                {result.duplicates.map((d) => (
                  <li key={d.bulkQuestionId}>Duplicate: row {d.excelRowNo} of {d.fileName}. {d.reason}</li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {summary && summary.totalToFix === 0 && !loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-slate-800 font-medium">Nothing to fix{batchId ? ' in this upload' : ''}.</p>
            <p className="text-sm text-slate-500 mt-1">
              Every uploaded question is valid and has a valid Type and Part. <Link to="/question-bank/upload" className="text-blue-600 hover:underline">Upload Excel</Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              ['', 'Need fixing', 'text-slate-900'],
              ['Error', 'Rows with errors', summary?.errorRows ? 'text-rose-600' : 'text-slate-700'],
              ['Type', 'Invalid Type', summary?.typeDisputed ? 'text-amber-600' : 'text-slate-700'],
              ['Part', 'Invalid Part', summary?.partDisputed ? 'text-amber-600' : 'text-slate-700'],
            ] as [ProblemFilter, string, string][]).map(([key, label, tone]) => (
              <button
                key={label}
                onClick={() => changeFilter({ problem: key, value: null })}
                className={cn(
                  'rounded-lg border bg-white p-3 text-left transition-colors hover:border-blue-300',
                  problem === key && valueFilter === null ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200',
                )}
              >
                <div className="text-xs text-slate-500">{label}</div>
                <div className={cn('text-2xl font-bold tabular-nums', tone)}>{problemCounts[key] ?? '–'}</div>
              </button>
            ))}
          </div>

          {/* Fix by value */}
          {summary && summary.totalDisputed > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Fix disputed values</CardTitle>
                {/* <CardDescription>
                  Change every question with the same wrong Type or Part at once. Click a value to list its questions below.
                </CardDescription> */}
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6">
                {renderValueList('Type', summary.typeValues, BULK_QUESTION_TYPES)}
                {renderValueList('Part', summary.partValues, BULK_QUESTION_PARTS)}
              </CardContent>
            </Card>
          )}

          {/* Question list */}
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <CardTitle>Questions</CardTitle>
                  <CardDescription>
                    {valueFilter !== null
                      ? <>Showing {problem} “{showValue(valueFilter)}”. <button className="text-blue-600 hover:underline" onClick={() => changeFilter({ problem: '', value: null })}>Show all</button></>
                      : 'Use Edit to correct any field of a row. Disputed Type/Part can also be set inline or for several rows at once.'}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {PROBLEM_FILTERS.map((p) => (
                    <Button
                      key={p || 'all'}
                      size="sm"
                      variant={problem === p && valueFilter === null ? 'secondary' : 'ghost'}
                      onClick={() => changeFilter({ problem: p, value: null })}
                      disabled={p !== '' && problemCounts[p] === 0}
                    >
                      {problemLabels[p]}{problemCounts[p] != null && ` (${problemCounts[p]})`}
                    </Button>
                  ))}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => { e.preventDefault(); setPage(1); setSearchApplied(search.trim()); }}
                  >
                    <div className="relative">
                      <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions" className="pl-9 h-8 w-56" />
                    </div>
                    <Button type="submit" size="sm" variant="outline">Search</Button>
                  </form>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selected.size > 0 && (
                <div className="mb-3 p-3 rounded-md border border-blue-200 bg-blue-50 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-blue-900">{selected.size} selected</span>
                  <span className="text-slate-600 ml-2">Type</span>
                  <select className={selectClass} value={bulkType} onChange={(e) => setBulkType(e.target.value)}>
                    <option value="">No change</option>
                    {BULK_QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-slate-600">Part</span>
                  <select className={selectClass} value={bulkPart} onChange={(e) => setBulkPart(e.target.value)}>
                    <option value="">No change</option>
                    {BULK_QUESTION_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <Button size="sm" onClick={() => resolve([...selected], bulkType, bulkPart)} disabled={(!bulkType && !bulkPart) || !!working}>
                    {working === 'bulk' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply to selected'}
                  </Button>
                  <span className="text-xs text-slate-500">(only disputed values change)</span>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={deleteSelected} disabled={!!working}>
                    {working === 'bulk-delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete selected</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
                </div>
              )}

              <div className="rounded-md border border-slate-200 overflow-x-auto relative min-h-[120px]">
                {loading && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                    <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label="Select all on this page" />
                      </TableHead>
                      <TableHead>Upload / Row</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Part</TableHead>
                      <TableHead>Department / Grade</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => {
                      const id = row.bulkQuestionId!;
                      const edit = rowEdits[id] ?? {};
                      const canSaveRow = (row.isTypeDisputed && !!edit.type) || (row.isPartDisputed && !!edit.part);
                      return (
                        <TableRow key={id} className={cn(selected.has(id) && 'bg-blue-50/50', row.hasError && !selected.has(id) && 'bg-rose-50/40')}>
                          <TableCell className="align-top">
                            <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} aria-label={`Select row ${row.excelRowNo}`} />
                          </TableCell>
                          <TableCell className="align-top text-xs text-slate-600 min-w-[140px]">
                            <div className="font-medium text-slate-800 break-words">{row.fileName}</div>
                            <div>Row {row.excelRowNo}</div>
                            {row.hasError && <div className="mt-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">ERROR</div>}
                          </TableCell>
                          <TableCell className="align-top min-w-[140px]">
                            {row.isTypeDisputed ? (
                              <div className="space-y-1">
                                <div className="text-xs text-amber-800 font-medium">“{showValue(row.questionType ?? '')}”</div>
                                <select className={selectClass} value={edit.type ?? ''} onChange={(e) => setRowEdit(id, { type: e.target.value })}>
                                  <option value="">Set type…</option>
                                  {BULK_QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-700">{row.questionType}</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top min-w-[110px]">
                            {row.isPartDisputed ? (
                              <div className="space-y-1">
                                <div className="text-xs text-amber-800 font-medium">“{showValue(row.questionPart ?? '')}”</div>
                                <select className={selectClass} value={edit.part ?? ''} onChange={(e) => setRowEdit(id, { part: e.target.value })}>
                                  <option value="">Set part…</option>
                                  {BULK_QUESTION_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-700">{row.questionPart}</span>
                            )}
                          </TableCell>
                          <CriteriaCell row={row} />
                          <QuestionCell row={row}>
                            {row.errors && row.errors.length > 0 && (
                              <div className="mt-2 space-y-0.5 text-xs text-rose-700">
                                {row.errors.map((e, idx) => <div key={idx}>Error: {e}</div>)}
                              </div>
                            )}
                          </QuestionCell>
                          <TableCell className="align-top text-right whitespace-nowrap">
                            {(row.isTypeDisputed || row.isPartDisputed) && (
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => resolve([id], row.isTypeDisputed ? edit.type : undefined, row.isPartDisputed ? edit.part : undefined, `row:${id}`)}
                                disabled={!canSaveRow || !!working}
                                title="Save the Type/Part chosen in this row"
                              >
                                {working === `row:${id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="ml-1" onClick={() => setEditRow(row)} disabled={!!working} title="Edit every field of this question">
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 ml-1"
                              onClick={() => deleteRow(row)}
                              disabled={!!working}
                              title="Delete this question"
                            >
                              {working === `delete:${id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {rows && items.length === 0 && !loading && (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-slate-500">No matching questions.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {rows && (
                <Pager page={rows.page} pageCount={Math.ceil(rows.total / rows.pageSize)} total={rows.total} onChange={setPage} />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <EditQuestionDialog row={editRow} onClose={() => setEditRow(null)} onSaved={onEdited} />
    </div>
  );
};

// ---- Full edit of one row ----

type EditForm = {
  grade: string; department: string; jobConcentration: string; location: string;
  questionType: string; questionPart: string; question: string;
  option1: string; option2: string; option3: string; option4: string; rightAnswer: string;
};

const toForm = (r: BulkQuestionRow): EditForm => ({
  grade: r.grade ?? '', department: r.department ?? '', jobConcentration: r.jobConcentration ?? '', location: r.location ?? '',
  questionType: r.questionType ?? '', questionPart: r.questionPart ?? '', question: r.question ?? '',
  option1: r.option1 ?? '', option2: r.option2 ?? '', option3: r.option3 ?? '', option4: r.option4 ?? '',
  rightAnswer: r.rightAnswer ?? '',
});

const rowIssues = (r: BulkQuestionRow): BulkQuestionIssue[] => [
  ...(r.errors ?? []).map((message) => ({ severity: 'Error' as const, code: 'STORED', message })),
  ...(r.isTypeDisputed ? [{ severity: 'Warning' as const, code: 'DISPUTED_TYPE', message: `Type “${showValue(r.questionType ?? '')}” is not MCQ or Descriptive.` }] : []),
  ...(r.isPartDisputed ? [{ severity: 'Warning' as const, code: 'DISPUTED_PART', message: `Part “${showValue(r.questionPart ?? '')}” is not 1, 2 or 3.` }] : []),
];

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <label className={cn('block space-y-1', className)}>
    <span className="text-xs font-medium text-slate-600">{label}</span>
    {children}
  </label>
);

const EditQuestionDialog: React.FC<{
  row: BulkQuestionRow | null;
  onClose: () => void;
  onSaved: (res: UpdateBulkQuestionResult) => void | Promise<void>;
}> = ({ row, onClose, onSaved }) => {
  const [form, setForm] = useState<EditForm | null>(null);
  // The values from the file when they were invalid, offered so the select can keep showing them.
  const [invalidType, setInvalidType] = useState('');
  const [invalidPart, setInvalidPart] = useState('');
  const [issues, setIssues] = useState<BulkQuestionIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setForm(toForm(row));
    setInvalidType(row.isTypeDisputed ? row.questionType ?? '' : '');
    setInvalidPart(row.isPartDisputed ? row.questionPart ?? '' : '');
    setIssues(rowIssues(row));
    setError(null);
  }, [row]);

  if (!row || !form) return null;

  const set = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));

  const isMcq = form.questionType === 'MCQ';
  const showOptions = isMcq || [form.option1, form.option2, form.option3, form.option4].some((o) => o.trim());

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<UpdateBulkQuestionResult>(`/question-bank-upload/questions/${row.bulkQuestionId}`, form);
      setForm(toForm(res.data.row));
      setIssues(res.data.issues);
      if (!res.data.isFixed) setError(res.data.message);
      await onSaved(res.data);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.issues) setIssues(data.issues);
      setError(errorMessage(err, 'Failed to save the question'));
    } finally {
      setSaving(false);
    }
  };

  const errors = issues.filter((i) => i.severity === 'Error');
  const warnings = issues.filter((i) => i.severity === 'Warning');

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Edit question</DialogTitle>
        <DialogDescription>
          Row {row.excelRowNo} of {row.fileName}. Saving re-checks the question with the same rules as an upload.
        </DialogDescription>
      </DialogHeader>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mb-4 space-y-1">
          {errors.map((i, idx) => (
            <div key={`e${idx}`} className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{i.message}</span>
            </div>
          ))}
          {warnings.map((i, idx) => (
            <div key={`w${idx}`} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{i.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Type">
            <select className={cn(selectClass, 'h-9 w-full')} value={form.questionType} onChange={set('questionType')}>
              {!BULK_QUESTION_TYPES.includes(form.questionType as never) && (
                <option value={form.questionType}>{showValue(form.questionType)} (invalid)</option>
              )}
              {invalidType && form.questionType !== invalidType && <option value={invalidType}>{showValue(invalidType)} (invalid)</option>}
              {BULK_QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Part">
            <select className={cn(selectClass, 'h-9 w-full')} value={form.questionPart} onChange={set('questionPart')}>
              {!BULK_QUESTION_PARTS.includes(form.questionPart as never) && (
                <option value={form.questionPart}>{showValue(form.questionPart)} (invalid)</option>
              )}
              {invalidPart && form.questionPart !== invalidPart && <option value={invalidPart}>{showValue(invalidPart)} (invalid)</option>}
              {BULK_QUESTION_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Grade"><Input value={form.grade} onChange={set('grade')} maxLength={100} /></Field>
          <Field label="Department"><Input value={form.department} onChange={set('department')} maxLength={200} /></Field>
          <Field label="Concentration"><Input value={form.jobConcentration} onChange={set('jobConcentration')} maxLength={200} /></Field>
          <Field label="Location"><Input value={form.location} onChange={set('location')} maxLength={200} /></Field>
        </div>

        <Field label="Question">
          <textarea className={textareaClass} rows={4} value={form.question} onChange={set('question')} />
        </Field>

        {showOptions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['option1', 'option2', 'option3', 'option4'] as const).map((k, i) => (
              <Field key={k} label={`Option ${i + 1}`}><Input value={form[k]} onChange={set(k)} /></Field>
            ))}
          </div>
        )}

        <Field label={isMcq ? 'Answer (option number 1–4, a letter a–d, or the option text)' : 'Answer'}>
          {isMcq ? (
            <Input value={form.rightAnswer} onChange={set('rightAnswer')} />
          ) : (
            <textarea className={textareaClass} rows={4} value={form.rightAnswer} onChange={set('rightAnswer')} />
          )}
        </Field>
      </div>

      {error && <p className="mt-4 text-sm text-amber-800">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>Close</Button>
        <Button variant="success" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

export default FixQuestionsPage;
