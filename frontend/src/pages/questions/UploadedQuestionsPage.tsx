import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Layers, Link2, Loader2, RefreshCw, Search, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BULK_QUESTION_TYPES, BulkQuestionRow, BulkQuestionRowPage, LookupMappingField, LookupMappingFieldData,
} from '@/types';
import { Pager, QuestionCell, TypePartBadges } from '@/components/questions/BulkQuestionParts';
import { errorMessage } from '@/lib/bulkQuestionUtils';

const PAGE_SIZE = 25;
// Filter value meaning "id is NULL" (not mapped yet).
const NONE = 'none';

const FILTERS: { key: LookupMappingField; param: string; label: string; textKey: keyof BulkQuestionRow; idKey: keyof BulkQuestionRow }[] = [
  { key: 'department', param: 'departmentId', label: 'Department', textKey: 'department', idKey: 'departmentId' },
  { key: 'location', param: 'locationId', label: 'Location', textKey: 'location', idKey: 'locationId' },
  { key: 'grade', param: 'gradeId', label: 'Grade', textKey: 'grade', idKey: 'gradeId' },
  { key: 'concentration', param: 'concentrationId', label: 'Concentration', textKey: 'jobConcentration', idKey: 'concentrationId' },
];

// The lookup fields are shown in two table columns: Department · Location and Grade · Concentration.
const FIELD_COLUMNS = [
  FILTERS.filter((f) => f.key === 'department' || f.key === 'location'),
  FILTERS.filter((f) => f.key === 'grade' || f.key === 'concentration'),
];

const selectClass = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm';

// Question Bank > Questions: every question saved from Excel uploads (Bulk_Questions_Excel),
// filtered by the Department / Location / Grade / Concentration ids set in Lookup Mapping.
// Filters live in the URL so a filtered list can be bookmarked or shared.
export const UploadedQuestionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lookups, setLookups] = useState<Record<string, LookupMappingFieldData> | null>(null);
  const [rows, setRows] = useState<BulkQuestionRowPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [reloadKey, setReloadKey] = useState(0);

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filterValue = (param: string) => searchParams.get(param) ?? '';
  const questionType = searchParams.get('type') ?? '';
  const searchApplied = searchParams.get('search') ?? '';
  const activeFilters = FILTERS.filter((f) => filterValue(f.param)).length + (questionType ? 1 : 0) + (searchApplied ? 1 : 0);

  const updateParams = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    api.get<Record<string, LookupMappingFieldData>>('/question-bank-mapping/options')
      .then((res) => setLookups(res.data))
      .catch((err) => setError(errorMessage(err, 'Failed to load the lookup lists')));
  }, []);

  const queryKey = searchParams.toString();
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
    FILTERS.forEach((f) => { const v = searchParams.get(f.param); if (v) params[f.param] = v; });
    if (questionType) params.questionType = questionType;
    if (searchApplied) params.search = searchApplied;
    api.get<BulkQuestionRowPage>('/question-bank-upload/questions', { params })
      .then((res) => { if (!cancelled) { setRows(res.data); setError(null); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Failed to load the questions')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, reloadKey]);

  // lookup id -> name, per field
  const names = useMemo(() => {
    const map: Record<string, Map<number, string>> = {};
    FILTERS.forEach((f) => { map[f.key] = new Map((lookups?.[f.key]?.options ?? []).map((o) => [o.lookupId, o.lookupText])); });
    return map;
  }, [lookups]);

  const clearAll = () => {
    setSearch('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Questions</h1>
          {/* <p className="text-sm text-slate-500 mt-1">
            All questions saved from Question Bank Excel uploads. Filter them by the Sys_Lookup items set in Mapping.
          </p> */}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/question-bank/upload">
            <Button>
              <UploadCloud className="h-4 w-4 mr-1.5" /> Upload
            </Button>
          </Link>
          <Link to="/question-bank/fix">
            <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
              <AlertTriangle className="h-4 w-4 mr-1.5" /> Errors
            </Button>
          </Link>
          <Link to="/question-bank/mapping">
            <Button variant="outline">
              <Link2 className="h-4 w-4 mr-1.5" /> Mapping
            </Button>
          </Link>
          <Link to="/question-bank/sets">
            <Button variant="outline">
              <Layers className="h-4 w-4 mr-1.5" /> Sets
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
               <CardTitle>Filters</CardTitle>
              <CardDescription>“Not mapped” lists the questions that have no id for that field yet.</CardDescription>
            </div>
             {/* <div className="flex gap-2">
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}><X className="h-3.5 w-3.5 mr-1" /> Clear filters</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
              </Button>
            </div>  */}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FILTERS.map((f) => {
              const data = lookups?.[f.key];
              return (
                <label key={f.key} className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">{f.label}</span>
                  <select
                    className={cn(selectClass, filterValue(f.param) && 'border-blue-400 ring-1 ring-blue-200')}
                    value={filterValue(f.param)}
                    onChange={(e) => updateParams({ [f.param]: e.target.value })}
                    disabled={!lookups}
                  >
                    <option value="">All</option>
                    <option value={NONE}>Not mapped (no {f.label} id)</option>
                    {data?.options.map((o) => (
                      <option key={o.lookupId} value={String(o.lookupId)}>
                        {o.lookupText}{o.isActive ? '' : ' — inactive'}
                      </option>
                    ))}
                  </select>
                  {data && !data.lookupTypeFound && (
                    <span className="text-[11px] text-amber-700">No “{data.lookupType}” lookup type in Sys_Lookup yet.</span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <select
              className={cn(selectClass, 'sm:w-48', questionType && 'border-blue-400 ring-1 ring-blue-200')}
              value={questionType}
              onChange={(e) => updateParams({ type: e.target.value })}
              aria-label="Question type"
            >
              <option value="">All types</option>
              {BULK_QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); updateParams({ search: search.trim() }); }}>
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question, grade, department, concentration or location" className="pl-9" />
              </div>
              <Button type="submit" variant="outline">Search</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Questions</CardTitle>
          <CardDescription>{rows ? `${rows.total} question(s)${activeFilters ? ' match the filters' : ''}.` : 'Loading…'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-x-auto relative min-h-[120px]">
            {loading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type / Part</TableHead>
                  {FIELD_COLUMNS.map((fields, i) => (
                    <TableHead key={i} className="min-w-[180px]">{fields.map((f) => f.label).join(' · ')}</TableHead>
                  ))}
                  <TableHead>Question</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows?.items.map((row) => (
                  <TableRow key={row.bulkQuestionId} className={cn(row.hasError && 'bg-rose-50/40')}>
                    <TableCell className="align-top">
                      <TypePartBadges row={row} />
                      {row.hasError && (
                        <Link to="/question-bank/fix?problem=Error" className="mt-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 hover:underline">ERROR</Link>
                      )}
                      {row.isDuplicate && <div className="text-[10px] text-violet-700 mt-1">duplicate</div>}
                    </TableCell>
                    {FIELD_COLUMNS.map((fields, i) => (
                      <TableCell key={i} className="align-top text-xs">
                        <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
                          {fields.map((f) => {
                            const text = row[f.textKey] as string | undefined;
                            const id = row[f.idKey] as number | undefined;
                            return (
                              <React.Fragment key={f.key}>
                                <dt className="text-slate-400">{f.label}</dt>
                                <dd className="min-w-0">
                                  <span className="text-slate-800">{text || '—'}</span>
                                  {id != null ? (
                                    <span className="block text-emerald-700">→ {names[f.key]?.get(id) ?? `Lookup #${id}`} <span className="text-slate-400">#{id}</span></span>
                                  ) : text ? (
                                    <span className="text-amber-700"> (not mapped)</span>
                                  ) : null}
                                </dd>
                              </React.Fragment>
                            );
                          })}
                        </dl>
                      </TableCell>
                    ))}
                    <QuestionCell row={row}>
                      {row.errors && row.errors.length > 0 && (
                        <div className="mt-2 space-y-0.5 text-xs text-rose-700">
                          {row.errors.map((e, idx) => <div key={idx}>Error: {e}</div>)}
                        </div>
                      )}
                    </QuestionCell>
                  </TableRow>
                ))}
                {rows && rows.items.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-slate-500">No questions match these filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {rows && (
            <Pager
              page={rows.page}
              pageCount={Math.ceil(rows.total / rows.pageSize)}
              total={rows.total}
              onChange={(p) => updateParams({ page: p > 1 ? String(p) : '' }, false)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadedQuestionsPage;
