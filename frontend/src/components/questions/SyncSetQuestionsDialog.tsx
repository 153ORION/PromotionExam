import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { BULK_QUESTION_PARTS, BULK_QUESTION_TYPES, QuestionSet, SetSyncCandidates, SetSyncResult } from '@/types';
import { QuestionCell, TypePartBadges } from '@/components/questions/BulkQuestionParts';
import { errorMessage } from '@/lib/bulkQuestionUtils';

const selectClass = 'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm';

// Question Sets > Sync: the bank questions that match the set's Location, Department, Grade and
// Concentration but are not in the set yet. Every question starts checked; the checked ones are
// added to the set's Question_Bank with the marks entered for their type.
export const SyncSetQuestionsDialog: React.FC<{
  set: QuestionSet;
  onClose: () => void;
  onSynced: (res: SetSyncResult) => void | Promise<void>;
}> = ({ set, onClose, onSynced }) => {
  const [data, setData] = useState<SetSyncCandidates | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [part, setPart] = useState('');
  const [mcqMarks, setMcqMarks] = useState('1');
  const [descriptiveMarks, setDescriptiveMarks] = useState('10');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<SetSyncCandidates>(`/questions/sets/${set.setId}/unsynced`)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setSelected(new Set(res.data.questions.map((q) => q.bulkQuestionId!)));
      })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Failed to load the questions to sync')); });
    return () => { cancelled = true; };
  }, [set.setId]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data?.questions ?? []).filter((q) =>
      (!type || q.questionType === type) &&
      (!part || q.questionPart === part) &&
      (!s || q.question.toLowerCase().includes(s)));
  }, [data, search, type, part]);

  const allShownSelected = shown.length > 0 && shown.every((q) => selected.has(q.bulkQuestionId!));
  const toggleShown = () => setSelected((prev) => {
    const next = new Set(prev);
    shown.forEach((q) => (allShownSelected ? next.delete(q.bulkQuestionId!) : next.add(q.bulkQuestionId!)));
    return next;
  });
  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectedRows = (data?.questions ?? []).filter((q) => selected.has(q.bulkQuestionId!));
  const selectedMcq = selectedRows.filter((q) => q.questionType === 'MCQ').length;
  const selectedDescriptive = selectedRows.length - selectedMcq;
  const marksValid = Number(mcqMarks) > 0 && Number(descriptiveMarks) > 0;
  const criteria = [set.locationName, set.departmentName, set.gradeName, set.concentrationName];

  const sync = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<SetSyncResult>(`/questions/sets/${set.setId}/sync`, {
        bulkQuestionIds: [...selected],
        mcqMarks: Number(mcqMarks),
        descriptiveMarks: Number(descriptiveMarks),
      });
      await onSynced(res.data);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to sync the questions'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }} className="max-w-5xl">
      <DialogHeader>
        <DialogTitle>Sync questions: {set.setName}</DialogTitle>
        <DialogDescription>
          Questions in the question bank for{' '}
          {['Location', 'Department', 'Grade', 'Concentration'].map((label, i) => (
            <span key={label}>{i > 0 && ' · '}<span className="font-medium text-slate-700">{criteria[i] || `any ${label.toLowerCase()}`}</span></span>
          ))}{' '}
          that are not in this set yet. Checked questions are added to the set.
        </DialogDescription>
      </DialogHeader>

      {!data && !error && (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 text-blue-500 animate-spin" /></div>
      )}

      {data && (
        <div className="space-y-3">
          {data.needsFixingCount > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {data.needsFixingCount} more matching question(s) are not listed because they need fixing first.{' '}
                <Link to="/question-bank/fix" className="font-semibold underline">Open Fix Questions</Link>
              </span>
            </div>
          )}

          {data.questions.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Every matching question is already in this set.</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text" className="pl-9" />
                </div>
                <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)} aria-label="Question type">
                  <option value="">All types</option>
                  {BULK_QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className={selectClass} value={part} onChange={(e) => setPart(e.target.value)} aria-label="Question part">
                  <option value="">All parts</option>
                  {BULK_QUESTION_PARTS.map((p) => <option key={p} value={p}>Part {p}</option>)}
                </select>
              </div>

              <div className="rounded-md border border-slate-200 max-h-[50vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input type="checkbox" checked={allShownSelected} onChange={toggleShown} disabled={shown.length === 0} aria-label="Select all shown" />
                      </TableHead>
                      <TableHead className="w-28">Type / Part</TableHead>
                      <TableHead>Question</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((q) => (
                      <TableRow key={q.bulkQuestionId} className="cursor-pointer" onClick={() => toggle(q.bulkQuestionId!)}>
                        <TableCell className="align-top">
                          <input
                            type="checkbox"
                            checked={selected.has(q.bulkQuestionId!)}
                            onChange={() => toggle(q.bulkQuestionId!)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Select question"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <TypePartBadges row={q} />
                          {q.isDuplicate && <div className="text-[10px] text-violet-700 mt-1">duplicate</div>}
                        </TableCell>
                        <QuestionCell row={q} />
                      </TableRow>
                    ))}
                    {shown.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-sm text-slate-500">No questions match these filters.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-slate-500">
                {selected.size} of {data.questions.length} selected ({selectedMcq} MCQ, {selectedDescriptive} descriptive)
                {shown.length < data.questions.length && `; ${shown.length} shown`}.
              </p>
            </>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}

      <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        {data && data.questions.length > 0 ? (
          <div className="flex gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Marks per MCQ</span>
              <Input type="number" min={0} step="any" value={mcqMarks} onChange={(e) => setMcqMarks(e.target.value)} className="w-28" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Marks per descriptive</span>
              <Input type="number" min={0} step="any" value={descriptiveMarks} onChange={(e) => setDescriptiveMarks(e.target.value)} className="w-28" />
            </label>
          </div>
        ) : <span />}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>Close</Button>
          {data && data.questions.length > 0 && (
            <Button variant="success" onClick={sync} disabled={saving || selected.size === 0 || !marksValid}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add {selected.size} to set
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default SyncSetQuestionsDialog;
