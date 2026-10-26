import React, { useState } from 'react';
import api from '@/services/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BULK_QUESTION_PARTS, BULK_QUESTION_TYPES, BulkQuestionIssue, CreateBulkQuestionResult, LookupMappingField, LookupMappingFieldData,
} from '@/types';
import { errorMessage, truncate } from '@/lib/bulkQuestionUtils';

const selectClass = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm';
const textareaClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600';

type TextKey = 'department' | 'location' | 'grade' | 'jobConcentration';
type IdKey = 'departmentId' | 'locationId' | 'gradeId' | 'concentrationId';
const OPTION_KEYS = ['option1', 'option2', 'option3', 'option4'] as const;

// Picked from the Sys_Lookup items of the field; typed in when that lookup type does not exist yet.
const LOOKUP_FIELDS: { key: LookupMappingField; label: string; textKey: TextKey; idKey: IdKey; maxLength: number }[] = [
  { key: 'department', label: 'Department', textKey: 'department', idKey: 'departmentId', maxLength: 200 },
  { key: 'location', label: 'Location', textKey: 'location', idKey: 'locationId', maxLength: 200 },
  { key: 'grade', label: 'Grade', textKey: 'grade', idKey: 'gradeId', maxLength: 100 },
  { key: 'concentration', label: 'Concentration', textKey: 'jobConcentration', idKey: 'concentrationId', maxLength: 200 },
];

type CreateForm = Record<TextKey | IdKey | 'questionType' | 'questionPart' | 'question' | 'rightAnswer' | typeof OPTION_KEYS[number], string>;

const EMPTY_FORM: CreateForm = {
  department: '', location: '', grade: '', jobConcentration: '',
  departmentId: '', locationId: '', gradeId: '', concentrationId: '',
  questionType: '', questionPart: '', question: '',
  option1: '', option2: '', option3: '', option4: '', rightAnswer: '',
};

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <label className={cn('block space-y-1', className)}>
    <span className="text-xs font-medium text-slate-600">{label}</span>
    {children}
  </label>
);

// Question Bank > Questions > New question: one question typed in by hand. The server checks it with
// the upload rules and saves it only when it is valid; a question that repeats a saved one needs
// "Save anyway". "Save & add another" keeps Type, Part and the lookups for the next question.
// Render it only while open, so every opening starts with an empty form.
export const CreateQuestionDialog: React.FC<{
  lookups: Record<string, LookupMappingFieldData> | null;
  onClose: () => void;
  onCreated: (res: CreateBulkQuestionResult) => void | Promise<void>;
}> = ({ lookups, onClose, onCreated }) => {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [issues, setIssues] = useState<BulkQuestionIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Set when the server refused the question as a duplicate; offers "Save anyway".
  const [duplicate, setDuplicate] = useState<{ message: string; addAnother: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const isMcq = form.questionType === 'MCQ';
  const canSave = !saving && !!form.questionType && !!form.questionPart && !!form.question.trim() && (!isMcq || !!form.rightAnswer);

  const payload = () => {
    const body: Record<string, string | number | null> = {
      questionType: form.questionType,
      questionPart: form.questionPart,
      question: form.question,
      rightAnswer: form.rightAnswer || null,
    };
    if (isMcq) OPTION_KEYS.forEach((k) => { body[k] = form[k] || null; });
    LOOKUP_FIELDS.forEach((f) => {
      if (lookups?.[f.key]?.lookupTypeFound) body[f.idKey] = form[f.idKey] ? Number(form[f.idKey]) : null;
      else body[f.textKey] = form[f.textKey] || null;
    });
    return body;
  };

  const save = async (addAnother: boolean, allowDuplicate = false) => {
    setSaving(true);
    setError(null);
    setIssues([]);
    setSaved(null);
    setDuplicate(null);
    try {
      const res = await api.post<CreateBulkQuestionResult>('/question-bank-upload/questions', payload(), {
        params: allowDuplicate ? { allowDuplicate: true } : undefined,
      });
      await onCreated(res.data);
      if (addAnother) {
        setForm((prev) => ({ ...prev, question: '', option1: '', option2: '', option3: '', option4: '', rightAnswer: '' }));
        setIssues(res.data.issues);
        setSaved(res.data.message);
      } else {
        onClose();
      }
    } catch (err: any) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.duplicate) {
        setDuplicate({ message: data.message, addAnother });
      } else {
        if (data?.issues) setIssues(data.issues);
        setError(errorMessage(err, 'Failed to save the question'));
      }
    } finally {
      setSaving(false);
    }
  };

  const errors = issues.filter((i) => i.severity === 'Error');
  const warnings = issues.filter((i) => i.severity === 'Warning');

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>New question</DialogTitle>
        <DialogDescription>
          Type a question in by hand. It is checked with the same rules as an Excel upload and saved under “Manual entry”.
        </DialogDescription>
      </DialogHeader>

      {saved && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
          <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{saved} Enter the next question.</span>
        </div>
      )}
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
            {/* An MCQ answer is an option number and a descriptive one is text: changing Type clears it. */}
            <select
              className={selectClass}
              value={form.questionType}
              onChange={(e) => { const questionType = e.target.value; setForm((prev) => ({ ...prev, questionType, rightAnswer: '' })); }}
            >
              <option value="">Select type…</option>
              {BULK_QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Part">
            <select className={selectClass} value={form.questionPart} onChange={set('questionPart')}>
              <option value="">Select part…</option>
              {BULK_QUESTION_PARTS.map((p) => <option key={p} value={p}>Part {p}</option>)}
            </select>
          </Field>
          {LOOKUP_FIELDS.map((f) => {
            const data = lookups?.[f.key];
            return (
              <Field key={f.key} label={f.label}>
                {data?.lookupTypeFound ? (
                  <select className={selectClass} value={form[f.idKey]} onChange={set(f.idKey)}>
                    <option value="">—</option>
                    {data.options.filter((o) => o.isActive).map((o) => (
                      <option key={o.lookupId} value={String(o.lookupId)}>{o.lookupText}</option>
                    ))}
                  </select>
                ) : (
                  <Input value={form[f.textKey]} onChange={set(f.textKey)} maxLength={f.maxLength} disabled={!lookups} />
                )}
              </Field>
            );
          })}
        </div>

        <Field label="Question">
          <textarea className={textareaClass} rows={4} value={form.question} onChange={set('question')} />
        </Field>

        {isMcq && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPTION_KEYS.map((k, i) => (
                <Field key={k} label={`Option ${i + 1}`}><Input value={form[k]} onChange={set(k)} /></Field>
              ))}
            </div>
            <Field label="Correct option">
              <select className={selectClass} value={form.rightAnswer} onChange={set('rightAnswer')}>
                <option value="">Select the correct option…</option>
                {OPTION_KEYS.map((k, i) => (form[k].trim() || form.rightAnswer === String(i + 1)) && (
                  <option key={k} value={String(i + 1)}>Option {i + 1}{form[k].trim() ? ` — ${truncate(form[k], 60)}` : ' (empty)'}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        {form.questionType === 'Descriptive' && (
          <Field label="Model answer">
            <textarea className={textareaClass} rows={4} value={form.rightAnswer} onChange={set('rightAnswer')} />
          </Field>
        )}
      </div>

      {duplicate && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          <span className="flex-1">{duplicate.message}</span>
          <Button size="sm" variant="outline" onClick={() => save(duplicate.addAnother, true)} disabled={saving}>Save anyway</Button>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>Close</Button>
        <Button variant="outline" onClick={() => save(true)} disabled={!canSave}>Save &amp; add another</Button>
        <Button variant="success" onClick={() => save(false)} disabled={!canSave}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

export default CreateQuestionDialog;
