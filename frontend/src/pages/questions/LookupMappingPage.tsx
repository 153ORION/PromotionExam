import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { AlertTriangle, ArrowRight, CheckCircle, Eye, Info, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BulkQuestionRow, BulkQuestionRowPage, LookupMappingField, LookupMappingFieldData, LookupMappingOption, LookupMappingValue,
} from '@/types';
import { CriteriaCell, Pager } from '@/components/questions/BulkQuestionParts';
import { errorMessage, truncate } from '@/lib/bulkQuestionUtils';

const FIELDS: { key: LookupMappingField; label: string; idKey: keyof BulkQuestionRow }[] = [
  { key: 'department', label: 'Department', idKey: 'departmentId' },
  { key: 'grade', label: 'Grade', idKey: 'gradeId' },
  { key: 'location', label: 'Location', idKey: 'locationId' },
  { key: 'concentration', label: 'Concentration', idKey: 'concentrationId' },
];

type StatusFilter = 'all' | 'unmapped' | 'mapped' | 'mixed';
const ROWS_PAGE_SIZE = 10;

// A pending choice per value: a lookup id, or null to remove the mapping.
type Pending = Record<string, number | null>;
type MapItem = { value: string; lookupId: number | null };

const isUnmapped = (v: LookupMappingValue) => v.unmappedRowCount === v.rowCount;
const isMixed = (v: LookupMappingValue) => v.targets.length > 1;
// The lookup id every row of the value has; undefined when unmapped or mixed.
const currentId = (v: LookupMappingValue) => (v.targets.length === 1 ? v.targets[0].lookupId ?? undefined : undefined);
// Rows a mapping to lookupId (null = remove) changes.
const rowsChanged = (v: LookupMappingValue, lookupId: number | null) =>
  v.targets.filter((t) => (t.lookupId ?? null) !== lookupId).reduce((n, t) => n + t.rowCount, 0);

// Question Bank > Lookup Mapping: maps the Department, Grade, Location and Concentration text of
// uploaded questions to Sys_Lookup ids. Each distinct text is mapped once and the id is written to
// every row with that text; the affected rows are shown before anything is saved.
export const LookupMappingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const field = (FIELDS.find((f) => f.key === searchParams.get('field'))?.key ?? 'department') as LookupMappingField;
  const fieldDef = FIELDS.find((f) => f.key === field)!;

  const [data, setData] = useState<LookupMappingFieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Pending>({});
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Rows dialog: preview before applying (with onConfirm) or just looking (without).
  const [rowsDialog, setRowsDialog] = useState<{ items: MapItem[]; confirm: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<LookupMappingFieldData>(`/question-bank-mapping/${field}`);
      setData(res.data);
    } catch (err) {
      setBanner({ type: 'error', text: errorMessage(err, 'Failed to load the values') });
    } finally {
      setLoading(false);
    }
  }, [field]);

  useEffect(() => {
    load();
  }, [load]);

  const switchField = (key: LookupMappingField) => {
    if (key === field) return;
    if (Object.keys(pending).length > 0 && !confirm('Discard the mappings you have chosen but not applied?')) return;
    setPending({});
    setData(null);
    setStatus('all');
    setSearch('');
    setBanner(null);
    setSearchParams({ field: key }, { replace: true });
  };

  const options = useMemo(() => data?.options ?? [], [data]);
  const optionNames = useMemo(() => new Map(options.map((o) => [o.lookupId, o.lookupText])), [options]);
  const selectOptions: SearchableSelectOption[] = useMemo(() => options.map((o) => ({
    id: o.lookupId,
    title: o.lookupText,
    subtitle: `ID ${o.lookupId}`,
    badge: o.isActive ? undefined : 'Inactive',
  })), [options]);

  const values = useMemo(() => data?.values ?? [], [data]);
  const byValue = useMemo(() => new Map(values.map((v) => [v.value, v])), [values]);

  const counts = {
    all: values.length,
    unmapped: values.filter(isUnmapped).length,
    mapped: values.filter((v) => currentId(v) !== undefined).length,
    mixed: values.filter(isMixed).length,
  };
  const unmappedRows = values.reduce((n, v) => n + v.unmappedRowCount, 0);
  const totalRows = values.reduce((n, v) => n + v.rowCount, 0);

  const visible = values.filter((v) => {
    if (status === 'unmapped' && !isUnmapped(v)) return false;
    if (status === 'mapped' && currentId(v) === undefined) return false;
    if (status === 'mixed' && !isMixed(v)) return false;
    const s = search.trim().toLowerCase();
    return !s || v.value.toLowerCase().includes(s);
  });

  // Pending choices that would actually change rows.
  const changes: MapItem[] = Object.entries(pending)
    .filter(([value, lookupId]) => {
      const v = byValue.get(value);
      return v && rowsChanged(v, lookupId) > 0;
    })
    .map(([value, lookupId]) => ({ value, lookupId }));

  const suggestions = values.filter((v) => isUnmapped(v) && v.suggestedLookupId != null && !(v.value in pending));

  const choose = (value: string, lookupId: number | null) => setPending((prev) => ({ ...prev, [value]: lookupId }));
  const discard = (value: string) => setPending((prev) => { const next = { ...prev }; delete next[value]; return next; });

  const useSuggestions = () =>
    setPending((prev) => {
      const next = { ...prev };
      suggestions.forEach((v) => { next[v.value] = v.suggestedLookupId!; });
      return next;
    });

  const apply = async (items: MapItem[]) => {
    setSaving(true);
    try {
      const res = await api.post<{ updatedRows: number; message: string }>(`/question-bank-mapping/${field}`, { items });
      setBanner({ type: 'success', text: res.data.message });
      setPending((prev) => {
        const next = { ...prev };
        items.forEach((i) => delete next[i.value]);
        return next;
      });
      setRowsDialog(null);
      await load();
    } catch (err) {
      setBanner({ type: 'error', text: errorMessage(err, 'Failed to save the mapping') });
    } finally {
      setSaving(false);
    }
  };

  const targetLabel = (lookupId: number | null) =>
    lookupId == null ? 'Not mapped' : optionNames.get(lookupId) ?? `Lookup #${lookupId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lookup Mapping</h1>
          {/* <p className="text-sm text-slate-500 mt-1">
            Link the Department, Grade, Location and Concentration names of uploaded questions to Sys_Lookup items.
            Each name is mapped once and the id is written to every question with that name.
          </p> */}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {FIELDS.map((f) => (
          <button
            key={f.key}
            onClick={() => switchField(f.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              f.key === field ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {banner && (
        <div className={cn(
          'p-4 rounded-lg flex items-start gap-3 border',
          banner.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200',
        )}>
          {banner.type === 'success'
            ? <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            : <AlertTriangle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />}
          <p className="text-sm flex-1">{banner.text}</p>
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {data && !data.lookupTypeFound && (
        <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-900 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            There is no lookup type named <b>{data.lookupType}</b>, so {fieldDef.label.toLowerCase()} names cannot be mapped yet.
            Create it in <Link to="/admin/lookup-types" className="underline font-medium">Lookup Types</Link>, add its items
            in <Link to="/admin/lookups" className="underline font-medium">Lookups</Link>, then Refresh.
          </span>
        </div>
      )}
      {/* {data && data.lookupTypeFound && (
        <div className="p-3 rounded-md border border-blue-200 bg-blue-50 text-blue-900 text-sm flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {options.length === 0
              ? <>The <b>{data.lookupType}</b> lookup has no items yet. </>
              : <>{options.length} {data.lookupType} item(s) in Sys_Lookup. </>}
            If an item is missing, add it in <Link to="/admin/lookups" className="underline font-medium">Lookups</Link> and
            Refresh; names you cannot map yet simply stay unmapped.
          </span>
        </div>
      )} */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `${fieldDef.label} names`, value: counts.all, tone: 'text-slate-900' },
          { label: 'Names not mapped', value: counts.unmapped, tone: counts.unmapped ? 'text-amber-600' : 'text-emerald-600' },
          { label: 'Questions not mapped', value: `${unmappedRows} / ${totalRows}`, tone: unmappedRows ? 'text-amber-600' : 'text-emerald-600' },
          { label: `Questions with no ${fieldDef.label.toLowerCase()}`, value: data?.emptyRowCount ?? 0, tone: 'text-slate-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className={cn('text-2xl font-bold tabular-nums', s.tone)}>{data ? s.value : '–'}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle>{fieldDef.label} names in uploaded questions</CardTitle>
              <CardDescription>
                Choose the Sys_Lookup item for each name, then Apply. You see the affected questions before they change.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'unmapped', 'mapped', 'mixed'] as StatusFilter[]).map((s) => (
                <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} onClick={() => setStatus(s)}>
                  {s === 'all' ? 'All' : s === 'unmapped' ? 'Not mapped' : s === 'mapped' ? 'Mapped' : 'Mixed'} ({counts[s]})
                </Button>
              ))}
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${fieldDef.label.toLowerCase()}`} className="pl-9 h-8 w-52" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(suggestions.length > 0 || changes.length > 0) && (
            <div className="mb-3 p-3 rounded-md border border-blue-200 bg-blue-50 flex flex-wrap items-center gap-2 text-sm">
              {suggestions.length > 0 && (
                <Button size="sm" variant="outline" onClick={useSuggestions}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-blue-600" /> Use {suggestions.length} suggested match(es)
                </Button>
              )}
              {changes.length > 0 && (
                <>
                  <span className="text-blue-900">{changes.length} change(s) chosen, not applied yet.</span>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => setPending({})}>Discard</Button>
                  <Button size="sm" onClick={() => setRowsDialog({ items: changes, confirm: true })}>
                    Review and apply {changes.length} change(s)
                  </Button>
                </>
              )}
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
                  <TableHead>{fieldDef.label} (from Excel)</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead>Mapped to now</TableHead>
                  <TableHead className="min-w-[260px]">Map to Sys_Lookup item</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((v) => {
                  const hasPending = v.value in pending;
                  const selected = hasPending ? pending[v.value] : currentId(v) ?? null;
                  const changeCount = hasPending ? rowsChanged(v, pending[v.value]) : 0;
                  const suggested = v.suggestedLookupId != null && isUnmapped(v) && !hasPending;
                  return (
                    <TableRow key={v.value} className={cn(changeCount > 0 && 'bg-blue-50/50')}>
                      <TableCell className="align-top font-medium text-slate-800">{v.value}</TableCell>
                      <TableCell className="align-top text-right tabular-nums">{v.rowCount}</TableCell>
                      <TableCell className="align-top text-sm">
                        {v.targets.map((t) => (
                          <div key={t.lookupId ?? 'none'} className={cn(t.lookupId == null ? 'text-amber-700' : 'text-slate-700')}>
                            {t.lookupId == null ? 'Not mapped' : <>{t.lookupText} <span className="text-xs text-slate-400">#{t.lookupId}</span></>}
                            {v.targets.length > 1 && <span className="text-xs text-slate-500"> · {t.rowCount} question(s)</span>}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="align-top">
                        <SearchableSelect
                          options={selectOptions}
                          selectedId={selected}
                          onSelect={(o) => choose(v.value, o ? Number(o.id) : null)}
                          placeholder={options.length ? 'Choose item…' : 'No items yet'}
                          searchPlaceholder="Search name..."
                          noResultsText="No lookup item matches"
                          disabled={options.length === 0 || saving}
                          portal
                        />
                        {suggested && (
                          <button
                            className="mt-1 text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
                            onClick={() => choose(v.value, v.suggestedLookupId!)}
                          >
                            <Sparkles className="h-3 w-3" /> Suggested: {optionNames.get(v.suggestedLookupId!)}
                          </button>
                        )}
                        {changeCount > 0 && (
                          <div className="mt-1 text-xs text-blue-800">
                            {changeCount} question(s) will change to “{targetLabel(pending[v.value])}”.
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setRowsDialog({ items: [{ value: v.value, lookupId: selected }], confirm: false })} title="Show the questions with this name">
                          <Eye className="h-3.5 w-3.5 mr-1" /> Questions
                        </Button>
                        {changeCount > 0 && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => discard(v.value)} disabled={saving}>Undo</Button>
                            <Button size="sm" onClick={() => setRowsDialog({ items: [{ value: v.value, lookupId: pending[v.value] }], confirm: true })} disabled={saving}>
                              Apply
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data && visible.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-slate-500">
                      {values.length === 0 ? `No uploaded question has a ${fieldDef.label.toLowerCase()} yet.` : 'No matching names.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {rowsDialog && (
        <AffectedRowsDialog
          field={field}
          fieldLabel={fieldDef.label}
          idKey={fieldDef.idKey}
          items={rowsDialog.items}
          values={byValue}
          options={options}
          saving={saving}
          onClose={() => setRowsDialog(null)}
          onConfirm={rowsDialog.confirm ? () => apply(rowsDialog.items) : undefined}
        />
      )}
    </div>
  );
};

// Lists the questions behind one or more names. With onConfirm it is the review step of a
// mapping: it shows what each name changes to and how many questions are affected.
const AffectedRowsDialog: React.FC<{
  field: LookupMappingField;
  fieldLabel: string;
  idKey: keyof BulkQuestionRow;
  items: MapItem[];
  values: Map<string, LookupMappingValue>;
  options: LookupMappingOption[];
  saving: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}> = ({ field, fieldLabel, idKey, items, values, options, saving, onClose, onConfirm }) => {
  const [active, setActive] = useState(items[0]?.value ?? '');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<BulkQuestionRowPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(() => new Map(options.map((o) => [o.lookupId, o.lookupText])), [options]);
  const label = (id: number | null | undefined) => (id == null ? 'Not mapped' : names.get(id) ?? `Lookup #${id}`);
  const activeItem = items.find((i) => i.value === active);
  const totalChanged = items.reduce((n, i) => n + (values.get(i.value) ? rowsChanged(values.get(i.value)!, i.lookupId) : 0), 0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get<BulkQuestionRowPage>(`/question-bank-mapping/${field}/rows`, { params: { value: active, page, pageSize: ROWS_PAGE_SIZE } })
      .then((res) => { if (!cancelled) setRows(res.data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Failed to load the questions')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [field, active, page]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }} className="max-w-5xl">
      <DialogHeader>
        <DialogTitle>{onConfirm ? `Review ${fieldLabel.toLowerCase()} mapping` : `Questions with ${fieldLabel.toLowerCase()} “${active}”`}</DialogTitle>
        <DialogDescription>
          {onConfirm
            ? `${totalChanged} question(s) will get a new ${fieldLabel} id. Check the questions below, then apply.`
            : `Every question with this ${fieldLabel.toLowerCase()} name. A mapping changes all of them together.`}
        </DialogDescription>
      </DialogHeader>

      {onConfirm && (
        <div className="mb-4 rounded-md border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
          {items.map((i) => {
            const v = values.get(i.value);
            const changed = v ? rowsChanged(v, i.lookupId) : 0;
            return (
              <button
                key={i.value}
                onClick={() => { setActive(i.value); setPage(1); setRows(null); }}
                className={cn('w-full flex flex-wrap items-center gap-2 px-3 py-2 text-left text-sm', i.value === active ? 'bg-blue-50' : 'hover:bg-slate-50')}
              >
                <span className="font-medium text-slate-800">{i.value}</span>
                <span className="text-slate-400 text-xs">{v ? `now: ${v.targets.map((t) => label(t.lookupId)).join(', ')}` : ''}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                <span className={cn('font-medium', i.lookupId == null ? 'text-amber-700' : 'text-blue-700')}>{label(i.lookupId)}</span>
                {i.lookupId != null && <span className="text-xs text-slate-400">#{i.lookupId}</span>}
                <span className="ml-auto text-xs text-slate-500">{changed} question(s) change</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="text-xs text-slate-500 mb-2">
        Questions with {fieldLabel.toLowerCase()} “{active}”
        {onConfirm && activeItem && <> — highlighted rows change to “{label(activeItem.lookupId)}”</>}
      </div>
      <div className="rounded-md border border-slate-200 overflow-x-auto relative min-h-[120px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Upload / Row</TableHead>
              <TableHead>Department / Grade</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>{fieldLabel} id now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.items.map((r) => {
              const now = r[idKey] as number | undefined;
              const willChange = !!onConfirm && !!activeItem && (now ?? null) !== activeItem.lookupId;
              return (
                <TableRow key={r.bulkQuestionId} className={cn(willChange && 'bg-blue-50/60')}>
                  <TableCell className="align-top text-xs text-slate-600 min-w-[140px]">
                    <div className="font-medium text-slate-800 break-words">{r.fileName}</div>
                    <div>Row {r.excelRowNo}</div>
                  </TableCell>
                  <CriteriaCell row={r} />
                  <TableCell className="align-top text-sm text-slate-800 min-w-[260px] max-w-[420px]">
                    <div className="whitespace-pre-wrap" title={r.question}>{truncate(r.question, 200)}</div>
                  </TableCell>
                  <TableCell className="align-top text-sm whitespace-nowrap">
                    <span className={cn(now == null ? 'text-amber-700' : 'text-slate-700')}>{label(now)}</span>
                    {willChange && (
                      <div className="text-xs text-blue-700 flex items-center gap-1 mt-0.5">
                        <ArrowRight className="h-3 w-3" /> {label(activeItem!.lookupId)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows && rows.items.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-slate-500">No questions.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      {rows && <Pager page={rows.page} pageCount={Math.ceil(rows.total / rows.pageSize)} total={rows.total} onChange={setPage} />}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>{onConfirm ? 'Cancel' : 'Close'}</Button>
        {onConfirm && (
          <Button onClick={onConfirm} disabled={saving || totalChanged === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Apply to {totalChanged} question(s)
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
};

export default LookupMappingPage;
