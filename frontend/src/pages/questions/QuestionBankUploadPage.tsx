import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Loader2,
  Eye, Trash2, RefreshCw, Save, X, History, Search, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BulkQuestionBatch, BulkQuestionIssue, BulkQuestionRow, BulkQuestionRowPage,
  BulkQuestionUploadResult, BulkQuestionValidationResult,
} from '@/types';
import {
  CriteriaCell, Pager, QuestionCell, TypePartBadges,
} from '@/components/questions/BulkQuestionParts';
import { errorMessage, formatDateTime } from '@/lib/bulkQuestionUtils';

const MAX_FILE_MB = 10;
const PREVIEW_PAGE_SIZE = 25;
const VIEW_PAGE_SIZE = 25;

type PreviewFilter = 'all' | 'errors' | 'duplicates' | 'disputed' | 'warnings';

const isDuplicate = (r: BulkQuestionRow) => !r.hasError && (r.duplicateOfRowNo != null || r.duplicateOfBulkQuestionId != null);
const isDisputed = (r: BulkQuestionRow) => r.isTypeDisputed || r.isPartDisputed;

const duplicateLabel = (r: BulkQuestionRow) =>
  r.duplicateOfRowNo != null
    ? `Same as row ${r.duplicateOfRowNo} of this file`
    : `Already saved from ${r.duplicateOfFileName} (${formatDateTime(r.duplicateOfUploadedAt)})`;

export const QuestionBankUploadPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<BulkQuestionValidationResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; showFixLink?: boolean } | null>(null);

  // Excel row numbers of duplicates the user chose to keep; all other duplicates are skipped.
  const [keepRows, setKeepRows] = useState<Set<number>>(new Set());
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [previewPage, setPreviewPage] = useState(1);

  const [batches, setBatches] = useState<BulkQuestionBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Saved-rows viewer dialog
  const [viewBatch, setViewBatch] = useState<BulkQuestionBatch | null>(null);
  const [viewRows, setViewRows] = useState<BulkQuestionRowPage | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewSearch, setViewSearch] = useState('');
  const [viewSearchApplied, setViewSearchApplied] = useState('');
  const [viewPage, setViewPage] = useState(1);

  const fetchBatches = async () => {
    setBatchesLoading(true);
    try {
      const res = await api.get<BulkQuestionBatch[]>('/question-bank-upload/batches');
      setBatches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBatchesLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (!viewBatch) return;
    let cancelled = false;
    setViewLoading(true);
    api.get<BulkQuestionRowPage>(`/question-bank-upload/batches/${viewBatch.uploadBatchId}/rows`, {
      params: { search: viewSearchApplied || undefined, page: viewPage, pageSize: VIEW_PAGE_SIZE },
    })
      .then((res) => { if (!cancelled) setViewRows(res.data); })
      .catch((err) => { if (!cancelled) alert(errorMessage(err, 'Failed to load uploaded rows')); })
      .finally(() => { if (!cancelled) setViewLoading(false); });
    return () => { cancelled = true; };
  }, [viewBatch, viewPage, viewSearchApplied]);

  const buildForm = (f: File, extra: Record<string, string> = {}) => {
    const formData = new FormData();
    formData.append('file', f);
    Object.entries(extra).forEach(([k, v]) => formData.append(k, v));
    return formData;
  };

  const resetPreviewState = () => {
    setValidation(null);
    setKeepRows(new Set());
    setPreviewFilter('all');
    setPreviewPage(1);
  };

  const resetSelection = () => {
    setFile(null);
    resetPreviewState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = async (f: File, sheetName?: string) => {
    setValidating(true);
    resetPreviewState();
    try {
      const res = await api.post<BulkQuestionValidationResult>(
        '/question-bank-upload/validate',
        buildForm(f, sheetName ? { sheetName } : {}),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setValidation(res.data);
      if (res.data.errorRowCount > 0) setPreviewFilter('errors');
      else if (res.data.duplicateCount > 0) setPreviewFilter('duplicates');
      else if (res.data.disputedTypeCount + res.data.disputedPartCount > 0) setPreviewFilter('disputed');
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Failed to check the file') });
    } finally {
      setValidating(false);
    }
  };

  const selectFile = (f: File) => {
    setMessage(null);
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      resetSelection();
      setMessage({ type: 'error', text: 'Only Excel files (.xlsx or .xls) can be uploaded.' });
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      resetSelection();
      setMessage({ type: 'error', text: `The file is larger than ${MAX_FILE_MB} MB.` });
      return;
    }
    setFile(f);
    validate(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !validating && !saving) selectFile(f);
  };

  const rows = useMemo(() => validation?.rows ?? [], [validation]);
  const duplicateRows = useMemo(() => rows.filter(isDuplicate), [rows]);
  const disputedRowCount = useMemo(() => rows.filter((r) => !r.hasError && isDisputed(r)).length, [rows]);
  const keptDuplicateCount = duplicateRows.filter((r) => keepRows.has(r.excelRowNo)).length;
  const saveCount = rows.filter((r) => !isDuplicate(r) || keepRows.has(r.excelRowNo)).length;

  const issuesByRow = useMemo(() => {
    const map = new Map<number, BulkQuestionIssue[]>();
    (validation?.issues ?? []).forEach((i) => {
      if (!i.rowNo) return;
      map.set(i.rowNo, [...(map.get(i.rowNo) ?? []), i]);
    });
    return map;
  }, [validation]);
  const fileIssues = (validation?.issues ?? []).filter((i) => !i.rowNo);

  const filterCounts: Record<PreviewFilter, number> = {
    all: rows.length,
    errors: validation?.errorRowCount ?? 0,
    duplicates: duplicateRows.length,
    disputed: rows.filter(isDisputed).length,
    warnings: rows.filter((r) => (issuesByRow.get(r.excelRowNo) ?? []).some((i) => i.severity === 'Warning')).length,
  };

  const previewRows = useMemo(() => rows.filter((r) => {
    switch (previewFilter) {
      case 'errors': return r.hasError;
      case 'duplicates': return isDuplicate(r);
      case 'disputed': return isDisputed(r);
      case 'warnings': return (issuesByRow.get(r.excelRowNo) ?? []).some((i) => i.severity === 'Warning');
      default: return true;
    }
  }), [rows, previewFilter, issuesByRow]);
  const previewPageCount = Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE);
  const previewSlice = previewRows.slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE);

  const setKeep = (rowNo: number, keep: boolean) => {
    setKeepRows((prev) => {
      const next = new Set(prev);
      if (keep) next.add(rowNo); else next.delete(rowNo);
      return next;
    });
  };

  const canSave = !!validation && !validation.hasFileError && saveCount > 0;

  const handleSave = async () => {
    if (!file || !validation || !canSave) return;

    const notes: string[] = [];
    if (validation.errorRowCount > 0) notes.push(`${validation.errorRowCount} row(s) with errors will be saved and must be fixed in Fix Questions.`);
    if (duplicateRows.length - keptDuplicateCount > 0) notes.push(`${duplicateRows.length - keptDuplicateCount} duplicate(s) will be skipped.`);
    if (keptDuplicateCount > 0) notes.push(`${keptDuplicateCount} duplicate(s) will be saved again.`);
    if (disputedRowCount > 0) notes.push(`${disputedRowCount} disputed question(s) will be saved and must be fixed in Fix Questions.`);
    if (notes.length > 0 && !confirm(`Save ${saveCount} question(s)?\n\n${notes.join('\n')}`)) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post<BulkQuestionUploadResult>(
        '/question-bank-upload/upload',
        buildForm(file, {
          ...(validation.sheetName ? { sheetName: validation.sheetName } : {}),
          keepDuplicateRows: JSON.stringify([...keepRows]),
        }),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setMessage({ type: 'success', text: res.data.message, showFixLink: res.data.disputedRows + res.data.errorRows > 0 });
      resetSelection();
      fetchBatches();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.validation) setValidation(data.validation);
      setMessage({ type: 'error', text: errorMessage(err, 'Failed to save the questions') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (batch: BulkQuestionBatch) => {
    if (!confirm(`Delete all ${batch.rowCount} question(s) uploaded from "${batch.fileName}" on ${formatDateTime(batch.uploadedAt)}? This cannot be undone.`)) return;
    setDeletingId(batch.uploadBatchId);
    try {
      const res = await api.delete(`/question-bank-upload/batches/${batch.uploadBatchId}`);
      setMessage({ type: 'success', text: res.data?.message || 'Upload deleted.' });
      if (viewBatch?.uploadBatchId === batch.uploadBatchId) setViewBatch(null);
      fetchBatches();
    } catch (err) {
      alert(errorMessage(err, 'Failed to delete the upload'));
    } finally {
      setDeletingId(null);
    }
  };

  const openView = (batch: BulkQuestionBatch) => {
    setViewRows(null);
    setViewSearch('');
    setViewSearchApplied('');
    setViewPage(1);
    setViewBatch(batch);
  };

  const busy = validating || saving;

  return (
    <div className="space-y-6">
      {/* <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload Question Bank Excel</h1>
         <p className="text-sm text-slate-500 mt-1">
          Import questions from an Excel file into the bulk question table. The file is checked first; you decide what
          happens to duplicates before anything is saved. Rows with errors or disputed values are saved and corrected
          afterwards in <Link to="/question-bank/fix" className="text-blue-600 hover:underline">Fix Questions</Link>.
        </p> 
      </div> */}

      {message && (
        <div className={cn(
          'p-4 rounded-lg flex items-start gap-3 border',
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200',
        )}>
          {message.type === 'success'
            ? <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            : <AlertTriangle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />}
          <p className="text-sm flex-1">
            {message.text}
            {message.showFixLink && (
              <> <Link to="/question-bank/fix" className="font-semibold underline">Open Fix Questions</Link></>
            )}
          </p>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Step 1: choose and validate a file */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Select Excel File</CardTitle>
          <CardDescription>
            .xlsx or .xls, up to {MAX_FILE_MB} MB. Columns are matched by header name: Grade, Department, Concentration,
            Location, Part, Type, Question, Option1–Option4, Answer. Type must be MCQ or Descriptive and Part must be 1, 2
            or 3; other values are saved as disputed. Rows with errors are saved too, to be fixed later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors',
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50',
            )}
          >
            {validating ? (
              <>
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-700">Checking {file?.name}…</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-800">Drag and drop the Excel file here</p>
                <p className="text-xs text-slate-500 mb-4">or</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={busy}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  Browse files
                </Button>
              </>
            )}
            {file && !validating && (
              <div className="mt-4 px-3 py-2 bg-white text-slate-700 rounded-md flex items-center gap-3 border border-slate-200 max-w-md w-full justify-between">
                <span className="truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-slate-500 whitespace-nowrap">{(file.size / 1024).toFixed(0)} KB</span>
                <button onClick={resetSelection} className="text-slate-400 hover:text-slate-700" title="Clear"><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: check result, duplicates and preview */}
      {validation && file && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {validation.hasFileError
                    ? <XCircle className="h-5 w-5 text-rose-500" />
                    : validation.errorRowCount > 0
                      ? <AlertTriangle className="h-5 w-5 text-amber-500" />
                      : <CheckCircle className="h-5 w-5 text-emerald-500" />}
                  {validation.hasFileError
                    ? 'This file cannot be imported'
                    : validation.errorRowCount > 0
                      ? `${validation.errorRowCount} row(s) have errors; they will be saved for fixing`
                      : 'Ready to save'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {validation.sheetName && <>Sheet <span className="font-medium">{validation.sheetName}</span>, header on row {validation.headerRowNo}.</>}
                  {validation.skippedEmptyRows > 0 && ` ${validation.skippedEmptyRows} empty row(s) ignored.`}
                  {validation.cleanedCellCount > 0 && ` Extra spaces, tabs, line breaks and garbled characters cleaned up in ${validation.cleanedCellCount} cell(s).`}
                </CardDescription>
                {validation.availableSheets.length > 1 && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <label htmlFor="qb-sheet" className="text-slate-600">Sheet:</label>
                    <select
                      id="qb-sheet"
                      value={validation.sheetName}
                      onChange={(e) => validate(file, e.target.value)}
                      disabled={busy}
                      className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
                    >
                      {validation.availableSheets.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="text-xs text-slate-500">This file has {validation.availableSheets.length} sheets with questions.</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetSelection} disabled={saving}>Cancel</Button>
                <Button variant="success" onClick={handleSave} disabled={!canSave || saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save {saveCount} question(s)
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Question rows', value: validation.totalRows, tone: 'text-slate-900' },
                { label: 'MCQ', value: validation.mcqCount, tone: 'text-blue-700' },
                { label: 'Descriptive', value: validation.descriptiveCount, tone: 'text-slate-700' },
                { label: 'Disputed', value: filterCounts.disputed, tone: filterCounts.disputed ? 'text-amber-600' : 'text-slate-700' },
                { label: 'Duplicates', value: duplicateRows.length, tone: duplicateRows.length ? 'text-violet-700' : 'text-slate-700' },
                { label: 'Rows with errors', value: validation.errorRowCount, tone: validation.errorRowCount ? 'text-rose-600' : 'text-emerald-600' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">{s.label}</div>
                  <div className={cn('text-2xl font-bold tabular-nums', s.tone)}>{s.value}</div>
                </div>
              ))}
            </div>

            {fileIssues.length > 0 && (
              <div className="space-y-1">
                {fileIssues.map((i, idx) => (
                  <div key={idx} className={cn(
                    'p-3 rounded-md border text-sm flex items-start gap-2',
                    i.severity === 'Error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800',
                  )}>
                    {i.severity === 'Error' ? <XCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                    <span>{i.message}</span>
                  </div>
                ))}
              </div>
            )}

            {filterCounts.disputed > 0 && (
              <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {validation.disputedTypeCount > 0 && <>{validation.disputedTypeCount} question(s) have a Type other than MCQ or Descriptive. </>}
                  {validation.disputedPartCount > 0 && <>{validation.disputedPartCount} question(s) have a Part other than 1, 2 or 3. </>}
                  They will be saved as <b>disputed</b>; fix them afterwards in Question Bank &gt; Fix Questions.
                </span>
              </div>
            )}

            {duplicateRows.length > 0 && (
              <div className="p-3 rounded-md border border-violet-200 bg-violet-50 text-violet-900 text-sm flex flex-col md:flex-row md:items-center gap-3">
                <Copy className="h-4 w-4 shrink-0 hidden md:block" />
                <span className="flex-1">
                  {duplicateRows.length} question(s) repeat a question with the same part, grade, department, concentration and location.
                  {' '}<b>{duplicateRows.length - keptDuplicateCount}</b> will be skipped, <b>{keptDuplicateCount}</b> will be saved again.
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setKeepRows(new Set())} disabled={keptDuplicateCount === 0}>Skip all duplicates</Button>
                  <Button size="sm" variant="outline" onClick={() => setKeepRows(new Set(duplicateRows.map((r) => r.excelRowNo)))} disabled={keptDuplicateCount === duplicateRows.length}>Keep all duplicates</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPreviewFilter('duplicates'); setPreviewPage(1); }}>Review</Button>
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-800">Preview</h3>
                  <div className="flex flex-wrap gap-1">
                    {([
                      ['all', 'All'], ['errors', 'Errors'], ['duplicates', 'Duplicates'], ['disputed', 'Disputed'], ['warnings', 'Warnings'],
                    ] as [PreviewFilter, string][]).map(([key, label]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={previewFilter === key ? 'secondary' : 'ghost'}
                        onClick={() => { setPreviewFilter(key); setPreviewPage(1); }}
                        disabled={key !== 'all' && filterCounts[key] === 0}
                      >
                        {label} ({filterCounts[key]})
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Row</TableHead>
                        <TableHead>Type / Part</TableHead>
                        <TableHead>Department / Grade</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead className="w-40">Duplicate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewSlice.map((row) => {
                        const rowIssues = (issuesByRow.get(row.excelRowNo) ?? []).filter((i) => i.code !== 'DUPLICATE');
                        const dup = isDuplicate(row);
                        const kept = keepRows.has(row.excelRowNo);
                        return (
                          <TableRow key={row.excelRowNo} className={cn(row.hasError && 'bg-rose-50/60', dup && !kept && 'opacity-60')}>
                            <TableCell className="text-xs text-slate-500 align-top">{row.excelRowNo}</TableCell>
                            <TableCell className="align-top"><TypePartBadges row={row} /></TableCell>
                            <CriteriaCell row={row} />
                            <QuestionCell row={row}>
                              {rowIssues.length > 0 && (
                                <div className="mt-2 space-y-0.5 text-xs">
                                  {rowIssues.map((i, idx) => (
                                    <div key={idx} className={i.severity === 'Error' ? 'text-rose-700' : 'text-amber-700'}>
                                      {i.severity === 'Error' ? 'Error' : 'Warning'}: {i.message}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </QuestionCell>
                            <TableCell className="align-top text-xs">
                              {dup ? (
                                <div className="space-y-1.5">
                                  <div className="text-violet-800">{duplicateLabel(row)}</div>
                                  <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
                                    <button
                                      className={cn('px-2 py-1', !kept ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
                                      onClick={() => setKeep(row.excelRowNo, false)}
                                    >Skip</button>
                                    <button
                                      className={cn('px-2 py-1 border-l border-slate-300', kept ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
                                      onClick={() => setKeep(row.excelRowNo, true)}
                                    >Keep</button>
                                  </div>
                                </div>
                              ) : row.hasError ? (
                                <span className="text-rose-700">Saved with errors, to fix later</span>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Pager page={previewPage} pageCount={previewPageCount} total={previewRows.length} onChange={setPreviewPage} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">Uploaded Files</CardTitle>
              <CardDescription>Question bank files saved to the bulk question table.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchBatches} disabled={batchesLoading}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', batchesLoading && 'animate-spin')} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead className="text-right">MCQ</TableHead>
                  <TableHead className="text-right">Disputed</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Kept duplicates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchesLoading && batches.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : batches.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-sm text-slate-500">No files uploaded yet.</TableCell></TableRow>
                ) : batches.map((b) => (
                  <TableRow key={b.uploadBatchId}>
                    <TableCell className="font-medium text-slate-800">
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{b.fileName}{b.sheetName && <span className="text-xs font-normal text-slate-500"> · {b.sheetName}</span>}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">{formatDateTime(b.uploadedAt)}</TableCell>
                    <TableCell className="text-sm text-slate-600">{b.uploadedByName || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.rowCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.mcqCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.disputedCount > 0 ? (
                        <Link to={`/question-bank/fix?batch=${b.uploadBatchId}&problem=Disputed`} className="font-semibold text-amber-700 hover:underline">
                          {b.disputedCount}
                        </Link>
                      ) : 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.errorCount > 0 ? (
                        <Link to={`/question-bank/fix?batch=${b.uploadBatchId}&problem=Error`} className="font-semibold text-rose-700 hover:underline">
                          {b.errorCount}
                        </Link>
                      ) : 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.duplicateCount}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => openView(b)}><Eye className="h-3.5 w-3.5 mr-1" /> View</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDelete(b)}
                        disabled={deletingId === b.uploadBatchId}
                      >
                        {deletingId === b.uploadBatchId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />} Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Saved rows of one upload */}
      <Dialog open={!!viewBatch} onOpenChange={(open) => { if (!open) setViewBatch(null); }} className="max-w-6xl">
        {viewBatch && (
          <>
            <DialogHeader>
              <DialogTitle>{viewBatch.fileName}</DialogTitle>
              <DialogDescription>
                Uploaded {formatDateTime(viewBatch.uploadedAt)}{viewBatch.uploadedByName && ` by ${viewBatch.uploadedByName}`} · {viewBatch.rowCount} question(s)
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex gap-2 mb-3"
              onSubmit={(e) => { e.preventDefault(); setViewPage(1); setViewSearchApplied(viewSearch.trim()); }}
            >
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={viewSearch}
                  onChange={(e) => setViewSearch(e.target.value)}
                  placeholder="Search question, grade, department, concentration or location"
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline">Search</Button>
            </form>
            <div className="rounded-md border border-slate-200 overflow-x-auto relative min-h-[120px]">
              {viewLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Row</TableHead>
                    <TableHead>Type / Part</TableHead>
                    <TableHead>Department / Grade</TableHead>
                    <TableHead>Question</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewRows?.items.map((row) => (
                    <TableRow key={row.bulkQuestionId ?? row.excelRowNo}>
                      <TableCell className="text-xs text-slate-500 align-top">
                        {row.excelRowNo}
                        {row.isDuplicate && <div className="text-[10px] text-violet-700 mt-1">duplicate</div>}
                        {row.hasError && <div className="text-[10px] text-rose-700 mt-1">error</div>}
                      </TableCell>
                      <TableCell className="align-top"><TypePartBadges row={row} /></TableCell>
                      <CriteriaCell row={row} />
                      <QuestionCell row={row}>
                        {row.errors && row.errors.length > 0 && (
                          <div className="mt-2 space-y-0.5 text-xs text-rose-700">
                            {row.errors.map((e, idx) => <div key={idx}>Error: {e}</div>)}
                          </div>
                        )}
                      </QuestionCell>
                    </TableRow>
                  ))}
                  {viewRows && viewRows.items.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-slate-500">No matching questions.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {viewRows && (
              <Pager
                page={viewRows.page}
                pageCount={Math.ceil(viewRows.total / viewRows.pageSize)}
                total={viewRows.total}
                onChange={setViewPage}
              />
            )}
          </>
        )}
      </Dialog>
    </div>
  );
};

export default QuestionBankUploadPage;
